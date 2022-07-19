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

    // Define a function to create a node table with an ID as primary key, nodeId as an integer, nodeLabel, sessionId linked to the session table.
    static createNodesTable() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS nodes
                            (
                                id INTEGER PRIMARY KEY,
                                nodeId INTEGER NOT NULL,
                                nodeLabel TEXT,
                                sessionId INTEGER NOT NULL,
                                lastUpdate DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(sessionId) REFERENCES session(id)
                            );`)
            .run();
    }

    // Define a function to add or update a sessionId in the session table and update the lastUpdate datetime stamp with the current system time.
    static setSessionValue(sessionId) {
        this.initializeDatabase();
        this.db.prepare(`INSERT INTO session (sessionId) VALUES (?)
                             ON CONFLICT(sessionId)
                             DO UPDATE SET sessionId=excluded.sessionId;`)
            .run(sessionId);
    }

    // Define a function to set a key/value pair in the system table.
    static setSystemValue(key, value) {
        this.initializeDatabase();
        this.db.prepare(`INSERT OR REPLACE INTO system (key, value) VALUES (?, ?);`).run(key, value);
    }

    // Define a function to insert data into the node table.
    static insertNode(nodeId, nodeLabel, sessionId) {
        this.initializeDatabase();
        this.db.prepare(`INSERT INTO nodes (nodeId, nodeLabel, sessionId) VALUES (?, ?, ?);`).run(nodeId, nodeLabel, this.getSessionId(sessionId));
    }

    // Define a function to return the id for a sessionId.
    static getSessionId(sessionId) {
        this.initializeDatabase();
        const row = this.db.prepare(`SELECT * FROM session WHERE sessionId = ?;`).get(sessionId);
        if (row.length === 0) {
            return null;
        } else {
            return row.id;
        }
    }

    // Initialize the database schema and default values.
    static initializeDatabase() {
        if (!this.isInitialized()) {
            this.db.prepare(`PRAGMA foreign_keys = ON;`).run(); // Allow foreign key constraints to be enforced.
            this.createSystemTable();
            this.createSessionTable();
            this.createNodesTable();
            this.db.prepare(`INSERT INTO system (key, value) VALUES ('initialized', 'true');`).run();
        }
    }

    // Print the contents of the system table.
    static printSystemTable() {
        this.initializeDatabase();
        const rows = this.db.prepare(`SELECT * FROM system;`).all();
        console.log(rows);
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