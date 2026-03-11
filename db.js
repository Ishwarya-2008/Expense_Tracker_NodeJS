const fs = require("fs");
const path = require("path");
const mysql = require("mysql2");

const DATA_FILE = path.join(__dirname, "data.json");

function readJsonStore() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return { users: [], expenses: [], counters: { userId: 1, expenseId: 1 } };
        }

        const raw = fs.readFileSync(DATA_FILE, "utf8");
        const parsed = JSON.parse(raw || "{}");
        return {
            users: Array.isArray(parsed.users) ? parsed.users : [],
            expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
            counters: {
                userId: parsed?.counters?.userId || 1,
                expenseId: parsed?.counters?.expenseId || 1
            }
        };
    } catch (err) {
        console.error("JSON store read error:", err.message);
        return { users: [], expenses: [], counters: { userId: 1, expenseId: 1 } };
    }
}

function writeJsonStore(store) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

function createFallbackDb() {
    let store = readJsonStore();

    const fallback = {
        isFallback: true,
        query(sql, params, cb) {
            const done = typeof cb === "function" ? cb : () => {};

            try {
                const normalized = String(sql || "").replace(/\s+/g, " ").trim().toUpperCase();

                if (normalized.startsWith("CREATE TABLE IF NOT EXISTS USERS")) {
                    return done(null, { warningStatus: 0 });
                }

                if (normalized.startsWith("CREATE TABLE IF NOT EXISTS EXPENSES")) {
                    return done(null, { warningStatus: 0 });
                }

                if (normalized === "SELECT * FROM USERS WHERE EMAIL=?") {
                    const [email] = params;
                    const rows = store.users.filter(u => u.email === email);
                    return done(null, rows);
                }

                if (normalized === "INSERT INTO USERS (NAME, EMAIL, PASSWORD) VALUES (?, ?, ?)") {
                    const [name, email, password] = params;
                    const row = {
                        id: store.counters.userId++,
                        name,
                        email,
                        password,
                        created_at: new Date().toISOString()
                    };
                    store.users.push(row);
                    writeJsonStore(store);
                    return done(null, { insertId: row.id, affectedRows: 1 });
                }

                if (normalized === "SELECT * FROM USERS WHERE EMAIL=? AND PASSWORD=?") {
                    const [email, password] = params;
                    const rows = store.users.filter(u => u.email === email && u.password === password);
                    return done(null, rows);
                }

                if (normalized === "SELECT SUM(AMOUNT) AS TOTAL FROM EXPENSES WHERE USER_ID=?") {
                    const [userId] = params;
                    const total = store.expenses
                        .filter(e => Number(e.user_id) === Number(userId))
                        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
                    return done(null, [{ total }]);
                }

                if (normalized === "INSERT INTO EXPENSES (USER_ID,TITLE,AMOUNT,CATEGORY) VALUES (?,?,?,?)") {
                    const [user_id, title, amount, category] = params;
                    const row = {
                        id: store.counters.expenseId++,
                        user_id: Number(user_id),
                        title,
                        amount: Number(amount),
                        category: category || "General",
                        created_at: new Date().toISOString()
                    };
                    store.expenses.push(row);
                    writeJsonStore(store);
                    return done(null, { insertId: row.id, affectedRows: 1 });
                }

                if (normalized === "SELECT * FROM EXPENSES WHERE USER_ID=?") {
                    const [userId] = params;
                    const rows = store.expenses.filter(e => Number(e.user_id) === Number(userId));
                    return done(null, rows);
                }

                if (normalized === "UPDATE EXPENSES SET TITLE=?, AMOUNT=? WHERE ID=?") {
                    const [title, amount, id] = params;
                    let affectedRows = 0;
                    store.expenses = store.expenses.map(e => {
                        if (Number(e.id) === Number(id)) {
                            affectedRows += 1;
                            return { ...e, title, amount: Number(amount) };
                        }
                        return e;
                    });
                    writeJsonStore(store);
                    return done(null, { affectedRows });
                }

                if (normalized === "DELETE FROM EXPENSES WHERE ID=?") {
                    const [id] = params;
                    const before = store.expenses.length;
                    store.expenses = store.expenses.filter(e => Number(e.id) !== Number(id));
                    const affectedRows = before - store.expenses.length;
                    writeJsonStore(store);
                    return done(null, { affectedRows });
                }

                return done(new Error(`Unsupported fallback query: ${sql}`));
            } catch (err) {
                return done(err);
            }
        },
        getConnection(cb) {
            if (typeof cb === "function") {
                cb(null, { release() {} });
            }
        },
        on() {}
    };

    console.warn("Using local JSON fallback database");
    return fallback;
}

const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.warn(`Missing DB env vars (${missingEnvVars.join(", ")}). Switching to fallback DB.`);
    module.exports = createFallbackDb();
    return;
}

const useSsl = ["true", "1", "yes"].includes(
    String(process.env.DB_SSL || "").toLowerCase()
);

const rejectUnauthorized = !["false", "0", "no"].includes(
    String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false").toLowerCase()
);

const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: process.env.DB_CONNECT_TIMEOUT
        ? Number(process.env.DB_CONNECT_TIMEOUT)
        : 10000,
    ssl: useSsl
        ? {
            rejectUnauthorized
        }
        : undefined
});

let activeDb = mysqlPool;

function shouldFallback(err) {
    const code = err && err.code;
    return ["ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "PROTOCOL_CONNECTION_LOST"].includes(code);
}

mysqlPool.getConnection((err, connection) => {
    if (err) {
        console.error("MySQL initial connection failed:", err);
        if (shouldFallback(err)) {
            activeDb = createFallbackDb();
        }
        return;
    }

    connection.release();
    console.log("MySQL Connected");
});

mysqlPool.on("error", err => {
    console.error("MySQL pool error:", err.code || err.message);
    if (shouldFallback(err) && !activeDb.isFallback) {
        activeDb = createFallbackDb();
    }
});

const db = {
    query(sql, params, cb) {
        return activeDb.query(sql, params, (err, result) => {
            if (err && shouldFallback(err) && !activeDb.isFallback) {
                console.error("MySQL query failed. Switching to fallback DB:", err.code || err.message);
                activeDb = createFallbackDb();
                return activeDb.query(sql, params, cb);
            }
            return cb(err, result);
        });
    },
    getConnection(cb) {
        return activeDb.getConnection(cb);
    },
    on(event, handler) {
        if (typeof activeDb.on === "function") {
            return activeDb.on(event, handler);
        }
        return undefined;
    }
};

module.exports = db;
