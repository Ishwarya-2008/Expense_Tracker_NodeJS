const mysql = require("mysql2");

const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required database environment variables: ${missingEnvVars.join(", ")}`);
}

const useSsl = process.env.DB_SSL === "true";

const db = mysql.createPool({
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
            rejectUnauthorized:"false"
        }
        : undefined
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("MySQL initial connection failed:", err);
        return;
    }

    connection.release();
    console.log("MySQL Connected");
});

db.on("error", err => {
    console.error("MySQL pool error:", err.code || err.message);
});

module.exports = db;
