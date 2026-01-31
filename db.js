const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Ishwarya@2008",
    database: "Expense_app"
});

db.connect(err => {
    if (err) {
        throw err;
    }
    console.log("MySQL Connected");
});

module.exports = db;
