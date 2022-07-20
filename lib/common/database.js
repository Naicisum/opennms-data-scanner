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
    static createSessionTable() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS session
                            (
                                id INTEGER PRIMARY KEY NOT NULL,
                                sessionId TEXT UNIQUE NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP
                            );`)
            .run();
    }

    // Define a function to create a node table with an ID as primary key, nodeId as an integer, nodeLabel, sessionId
    // linked to the session table.
    static createNodesTable() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS nodes
                            (
                                id INTEGER PRIMARY KEY NOT NULL,
                                nodeId INTEGER NOT NULL,
                                nodeLabel TEXT NOT NULL,
                                sessionId INTEGER NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(sessionId) REFERENCES session(id)
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
                                nodeId INTEGER NOT NULL,
                                resourceId TEXT NOT NULL,
                                attributeId TEXT NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(nodeId) REFERENCES nodes(id)
                                CONSTRAINT unique_resourceId_and_attributeId_by_nodeId UNIQUE (resourceId, attributeId, nodeId)
                            );`)
            .run();
    }

    // Define a function to add or update a sessionId in the session table and update the lastUpdate datetime stamp
    // with the current system time.
    static setSessionValue(sessionId) {
        this.db.prepare(`INSERT INTO session (sessionId) VALUES (?)
                             ON CONFLICT(sessionId)
                             DO UPDATE SET sessionId=excluded.sessionId;`)
            .run(sessionId);
    }

    // Define a function to set a key/value pair in the system table.
    static setSystemValue(key, value) {
        this.db.prepare(`INSERT OR REPLACE INTO system (key, value) VALUES (?, ?);`).run(key, value);
    }

    // Define a function to insert data into the node table.
    static insertNode(nodeId, nodeLabel, sessionId) {
        this.db.prepare(`INSERT INTO nodes (nodeId, nodeLabel, sessionId) VALUES (?, ?, ?)
                             ON CONFLICT(nodeId, sessionId)
                             DO UPDATE SET nodeLabel=excluded.nodeLabel,
                                           lastUpdate=CURRENT_TIMESTAMP;`)
            .run(nodeId, nodeLabel, this.getSessionId(sessionId));
    }

    // Define a function to insert data into the resource table.
    static insertResource(nodeId, resourceId, attributeId) {
        this.db.prepare(`INSERT INTO resources (nodeId, resourceId, attributeId) VALUES (?, ?, ?)
                             ON CONFLICT(nodeId, resourceId, attributeId)
                             DO UPDATE SET lastUpdate=CURRENT_TIMESTAMP;`)
            .run(this.getNodeId(nodeId), resourceId, attributeId);
    }

    // Define a function to return an array of nodeIds for a sessionId.
    static getNodeIds(sessionId) {
        const rows = this.db.prepare(`SELECT * FROM nodes WHERE sessionId = ?;`)
                         .all(this.getSessionId(sessionId));
        if (rows.length === 0) {
            return null;
        } else {
            return rows.map(row => row.nodeId);
        }
    }

    // Define a function to return an array of resourceIds and attributeIds for a nodeId.
    static getResources(nodeId) {
        const rows = this.db.prepare(`SELECT * FROM resources WHERE nodeId = ?;`)
                         .all(this.getNodeId(nodeId));
        if (rows.length === 0) {
            return null;
        } else {
            return rows.map(row => ({
                resourceId: row.resourceId,
                attributeId: row.attributeId
            }));
        }
    }


    // Define a function to return the id for a sessionId.
    static getSessionId(sessionId) {
        const row = this.db.prepare(`SELECT * FROM session WHERE sessionId = ?;`).get(sessionId);
        if (row.length === 0) {
            return null;
        } else {
            return row.id;
        }
    }

    // Define a function to return the id for a nodeId.
    static getNodeId(nodeId) {
        const row = this.db.prepare(`SELECT * FROM nodes WHERE nodeId = ?;`).get(nodeId);
        if (row.length === 0) {
            return null;
        } else {
            return row.id;
        }
    }

    // Initialize the database schema and default values.
    static initializeDatabase() {
        if (!this.isInitialized()) {
            this.db.prepare(`DROP TABLE IF EXISTS resources;`).run(); // Drop the resources table.
            this.db.prepare(`DROP TABLE IF EXISTS nodes;`).run(); // Drop the nodes table.
            this.db.prepare(`DROP TABLE IF EXISTS session;`).run(); // Drop the session table.
            this.db.prepare(`DROP TABLE IF EXISTS system;`).run(); // Drop the system table.
            this.db.prepare(`PRAGMA foreign_keys = ON;`).run(); // Allow foreign key constraints to be enforced.
            this.db.prepare('PRAGMA journal_mode = WAL').run(); // Use write-ahead logging.
            this.createSystemTable();
            this.createSessionTable();
            this.createNodesTable();
            this.createResourcesTable();
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
        if (row.length === 0 || row.value !== 'true') {
            return false;
        } else {
            return true;
        }
    }

}

module.exports = Database;