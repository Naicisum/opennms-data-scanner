// Create a class to encapsulate the database functions.
class Database {
    static db = require('better-sqlite3')('./lib/better-sqlite3/transient.db');

    // Define a function to create a system table that will be used to store key/value pairs
    static createSystemTable() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS system
                            (
                                id INTEGER PRIMARY KEY NOT NULL,
                                key TEXT UNIQUE NOT NULL,
                                value TEXT NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP
                            );`)
            .run();
    }

    // Define a function to create a session table with a sessionId column.
    static createSessionsTable() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS sessions
                            (
                                id INTEGER PRIMARY KEY NOT NULL,
                                sessionId TEXT UNIQUE NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP
                            );`)
            .run();
    }

    // Define a function to create a node table with an ID as primary key, nodeId as an integer, nodeLabel, sessionsId
    // linked to the sessions table.
    static createNodesTable() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS nodes
                            (
                                id INTEGER PRIMARY KEY NOT NULL,
                                sessionId INTEGER NOT NULL,
                                nodeId INTEGER NOT NULL,
                                nodeLabel TEXT NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(sessionId) REFERENCES sessions(id)
                                CONSTRAINT unique_nodeId_by_sessionId UNIQUE (nodeId, sessionId)
                            );`)
            .run();
    }

    // Define a function to create a resources table with an ID as primary key, nodeId as a foreign key to the nodes
    // table, resourceId as a string, attributeId as a string, and lastUpdate datetime stamp with the current
    // system time.
    static createResourcesTable() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS resources
                            (
                                id INTEGER PRIMARY KEY NOT NULL,
                                sessionId INTEGER NOT NULL,
                                nodeId INTEGER NOT NULL,
                                resourceId TEXT NOT NULL,
                                attributeId TEXT NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(nodeId) REFERENCES nodes(id)
                                FOREIGN KEY(sessionId) REFERENCES sessions(id)  
                                CONSTRAINT unique_nodeId_resourceId_attributeId_by_sessionId UNIQUE (sessionId, nodeId, resourceId, attributeId)
                            );`)
            .run();
    }

    // Define a function to create a results_summary table with an id as primary key, a sessionId as a foreign key,
    // a nodecount as an integer, a nodetotal as an integer, a resourcecount as an integer, a resourcetotal as an
    // integer, a status as a string, and a lastUpdate datetime stamp with the current system time.
    static createResultsSummaryTable() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS results_summary
                            (
                                id INTEGER PRIMARY KEY NOT NULL,
                                sessionId INTEGER UNIQUE NOT NULL,
                                nodecount INTEGER NOT NULL,
                                nodetotal INTEGER NOT NULL,
                                resourcecount INTEGER NOT NULL,
                                resourcetotal INTEGER NOT NULL,
                                status TEXT NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(sessionId) REFERENCES sessions(id)
                            );`)
            .run();
    }

    // Define a function to create a results_detail table with an id as primary key, a summaryId as a foreign key
    // to the results_summary table, a nodeId as a foreign key to the nodes table, a resourceId as a foreign key
    // to the resources table, a attributeId as a foreign key to the resources table, a valid_results as an integer,
    // a invalid_results as an integer, a lastUpdate datetime stamp with the current system time.
    static createResultsDetailTable() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS results_detail
                            (
                                id INTEGER PRIMARY KEY NOT NULL,
                                summaryId INTEGER NOT NULL,
                                nodeId INTEGER NOT NULL,
                                resourcesId INTEGER NOT NULL,
                                valid_results INTEGER NOT NULL,
                                invalid_results INTEGER NOT NULL,
                                status TEXT NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(summaryId) REFERENCES results_summary(id)
                                FOREIGN KEY(nodeId) REFERENCES nodes(id)
                                FOREIGN KEY(resourcesId) REFERENCES resources(id)
                                CONSTRAINT unique_summaryId_nodeId_resourcesId UNIQUE (summaryId, nodeId, resourcesId)
                            );`)
            .run();
    }

    // Define a function to initialize or update a row in the results_detail table.
    // The row will be updated if the summaryId, nodeId, resourceId, and attributeId
    // match the parameters.
    // If the row does not exist, a new row will be created.
    static setResultsDetailValue(sessionId, nodeId, resourceId, attributeId, valid_results = 0, invalid_results = 0, status = 'unset') {
        this.db.prepare(`INSERT INTO results_detail (summaryId, nodeId, resourcesId, valid_results, invalid_results, status)
                             VALUES (?, ?, ?, ?, ?, ?)
                             ON CONFLICT(summaryId, nodeId, resourcesId)
                             DO UPDATE SET valid_results=excluded.valid_results,
                                           invalid_results=excluded.invalid_results,
                                           status=excluded.status;`)
            .run(this.getSummaryId(sessionId), this.getNodeId(sessionId, nodeId), this.getResourceId(sessionId, nodeId, resourceId, attributeId), valid_results, invalid_results, status);
    }

    // Define a function to add or update a sessionId in the results_summary table and update the lastUpdate
    // datetime stamp with the current system time.
    static setResultsSummaryValue(sessionId, nodecount, nodetotal, resourcecount, resourcetotal, status) {
        this.db.prepare(`INSERT INTO results_summary (sessionId, nodecount, nodetotal, resourcecount, resourcetotal, status)
                             VALUES (?, ?, ?, ?, ?, ?)
                             ON CONFLICT(sessionId)
                             DO UPDATE SET nodecount=excluded.nodecount,
                                           nodetotal=excluded.nodetotal,
                                           resourcecount=excluded.resourcecount,
                                           resourcetotal=excluded.resourcetotal,
                                           status=excluded.status,
                                           lastUpdate=CURRENT_TIMESTAMP;`)
            .run(this.getSessionId(sessionId), nodecount, nodetotal, resourcecount, resourcetotal, status);
    }

    // Define a function to increment the nodecount by one in the results_summary table
    // where the sessionId matches the sessionId parameter.
    static incrementNodecountInSummary(sessionId) {
        this.db.prepare(`UPDATE results_summary SET nodecount = nodecount + 1 WHERE sessionId = ?;`)
            .run(this.getSessionId(sessionId));
    }

    // Define a function to increment the resourcecount by one in the results_summary table
    // where the sessionId matches the sessionId parameter.
    static incrementResourcecountInSummary(sessionId) {
        this.db.prepare(`UPDATE results_summary SET resourcecount = resourcecount + 1 WHERE sessionId = ?;`)
            .run(this.getSessionId(sessionId));
    }

    // Define a function to increment the resourcetotal by specified amount in the results_summary table
    // where the sessionId matches the sessionId parameter.
    static incrementResourcetotalInSummary(sessionId, amount) {
        this.db.prepare(`UPDATE results_summary SET resourcetotal = resourcetotal + ? WHERE sessionId = ?;`)
            .run(amount, this.getSessionId(sessionId));
    }

    // Define a function to set the status text field in the summary_results where the sessionId matches the
    // sessionId parameter.
    static setStatusInSummary(sessionId, status) {
        this.db.prepare(`UPDATE results_summary SET status = ? WHERE sessionId = ?;`).run(status, sessionId);
    }


    // Define a function to add or update a sessionId in the sessions table and update the lastUpdate datetime stamp
    // with the current system time.
    static setSessionValue(sessionId) {
        this.db.prepare(`INSERT INTO sessions (sessionId) VALUES (?)
                             ON CONFLICT(sessionId)
                             DO UPDATE SET lastUpdate=CURRENT_TIMESTAMP;`)
            .run(sessionId);
    }

    // Define a function to set a key/value pair in the system table.
    static setSystemValue(key, value) {
        this.db.prepare(`INSERT OR REPLACE INTO system (key, value) VALUES (?, ?);`).run(key, value);
    }

    // Define a function to insert data into the node table.
    static insertNode(sessionId, nodeId, nodeLabel) {
        this.db.prepare(`INSERT INTO nodes (sessionId, nodeId, nodeLabel) VALUES (?, ?, ?)
                             ON CONFLICT(nodeId, sessionId)
                             DO UPDATE SET nodeLabel=excluded.nodeLabel,
                                           lastUpdate=CURRENT_TIMESTAMP;`)
            .run(this.getSessionId(sessionId), nodeId, nodeLabel);
    }

    // Define a function to insert data into the resource table.
    static insertResource(sessionId, nodeId, resourceId, attributeId) {
        this.db.prepare(`INSERT INTO resources (sessionId, nodeId, resourceId, attributeId) VALUES (?, ?, ?, ?)
                             ON CONFLICT(sessionId, nodeId, resourceId, attributeId)
                             DO UPDATE SET lastUpdate=CURRENT_TIMESTAMP;`)
            .run(this.getSessionId(sessionId), this.getNodeId(sessionId, nodeId), resourceId, attributeId);
    }

    // Define a function to return an array of nodes for a sessionId.
    static getNodes(sessionId) {
        const rows = this.db.prepare(`SELECT * FROM nodes WHERE sessionId = ?;`)
                         .all(this.getSessionId(sessionId));
        if (rows.length === 0) {
            return null;
        } else {
            return rows.map(row => row.nodeId);
        }
    }

    // Define a function to return an array of resourceIds and attributeIds for a nodeId.
    static getResources(sessionId, nodeId) {
        const rows = this.db.prepare(`SELECT * FROM resources WHERE sessionId = ? AND nodeId = ?;`)
                         .all(this.getSessionId(sessionId), this.getNodeId(sessionId, nodeId));
        if (rows.length === 0) {
            return null;
        } else {
            return rows.map(row => ({
                id: row.id,
                nodeId: nodeId,
                resourceId: row.resourceId,
                attributeId: row.attributeId
            }));
        }
    }

    // Define a function to return the id for a sessionId.
    static getSessionId(sessionId) {
        const row = this.db.prepare(`SELECT * FROM sessions WHERE sessionId = ?;`).get(sessionId);
        return (typeof row?.id !== undefined) ? row.id : null;
    }

    // Define a function to return the id for a nodeId.
    static getNodeId(sessionId, nodeId) {
        const row = this.db.prepare(`SELECT * FROM nodes WHERE sessionId = ? AND nodeId = ?;`)
                        .get(this.getSessionId(sessionId), nodeId);
        return (typeof row?.id !== undefined) ? row.id : null;
    }

    // Define a function to return the id for a sessionId, resourceId, and attributeId.
    static getResourceId(sessionId, nodeId, resourceId, attributeId) {
        const row = this.db.prepare(`SELECT * FROM resources WHERE sessionId = ? AND nodeId = ? AND resourceId = ? AND attributeId = ?;`)
                         .get(this.getSessionId(sessionId), this.getNodeId(sessionId, nodeId), resourceId, attributeId);
        return (typeof row?.id !== undefined) ? row.id : null;
    }

    // Define a function to return the id for a summaryId.
    static getSummaryId(sessionId) {
        const row = this.db.prepare(`SELECT * FROM results_summary WHERE sessionId = ?;`).get(this.getSessionId(sessionId));
        return (typeof row?.id !== undefined) ? row.id : null;
    }

    // Initialize the database schema and default values.
    static initializeDatabase() {
        if (!this.isInitialized()) {
            this.db.prepare(`DROP TABLE IF EXISTS resources;`).run(); // Drop the resources table.
            this.db.prepare(`DROP TABLE IF EXISTS nodes;`).run(); // Drop the nodes table.
            this.db.prepare(`DROP TABLE IF EXISTS sessions;`).run(); // Drop the session table.
            this.db.prepare(`DROP TABLE IF EXISTS system;`).run(); // Drop the system table.
            this.db.prepare(`PRAGMA foreign_keys = ON;`).run(); // Allow foreign key constraints to be enforced.
            this.db.prepare('PRAGMA journal_mode = WAL').run(); // Use write-ahead logging.
            this.createSystemTable();
            this.createSessionsTable();
            this.createNodesTable();
            this.createResourcesTable();
            this.createResultsSummaryTable();
            this.createResultsDetailTable();
            this.db.prepare(`INSERT INTO system (key, value) VALUES ('initialized', 'true');`).run();
        }
    }

    // A function to check the system table to see if it has been initialized.
    static isInitialized() {
        let row;
        try {
            row = this.db.prepare(`SELECT * FROM system WHERE key = 'initialized';`).get();
        } catch (err) {
            return false;
        }
        return !(row.length === 0 || row.value !== 'true');
    }

}

module.exports = Database;