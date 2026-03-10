const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const db = require("./db");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server); 

app.use(express.json());
app.use(express.static(path.join(__dirname,"public")));

const SECRET = "secretkey";

app.post("/register", (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ msg: "All fields required" });
    }

    db.query("SELECT * FROM users WHERE email=?", [email], (err, data) => {
        if (err) return res.status(500).json({ msg: "DB error" });

        if (data.length > 0) {
            return res.status(400).json({ msg: "Email already registered" });
        }

        db.query("INSERT INTO users (name, email, password) VALUES (?, ?, ?)",[name, email, password],(err2, result) => {
                if (err2) {
                    return res.status(500).json({ msg: "DB insert error" });
                }
                res.json({ msg: "Registered successfully" });
            }
        );
    });
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE email=? AND password=?",
        [email, password],
        (err, data) => {
            if (data.length === 0)
                return res.status(400).json({ msg: "Invalid login" });

            const token = jwt.sign({ id: data[0].id }, SECRET, {
                expiresIn: "1h"
            });

            res.json({ token });
        }
    );
});


io.on("connection", socket => {
    console.log("Client connected");

    function verifyToken(token) {
        try {
            return jwt.verify(token, SECRET);
        } catch (err) {
            socket.emit('unauthorized', { msg: err && err.name ? err.name : 'InvalidToken' });
            return null;
        }
    }

    function sendTotal(userId) {
        db.query(
            "SELECT SUM(amount) AS total FROM expenses WHERE user_id=?",
            [userId],
            (err, result) => {
                socket.emit("totalAmount", result[0].total || 0);
            }
        );
    }

    socket.on("addExpense", data => {
        const user = verifyToken(data.token);
        if (!user) return;

        db.query(
            "INSERT INTO expenses (user_id,title,amount,category) VALUES (?,?,?,?)",
            [user.id, data.title, data.amount, data.category],
            (err3, result3) => {
                socket.emit("message", "Added");
                db.query(
                    "SELECT * FROM expenses WHERE user_id=?",
                    [user.id],
                    (err4, rows) => socket.emit("expenses", rows)
                );

                sendTotal(user.id);
            }
        );
    });

    socket.on("getExpenses", token => {
        const user = verifyToken(token);
        if (!user) return;

        db.query(
            "SELECT * FROM expenses WHERE user_id=?",
            [user.id],
            (err, result) => socket.emit("expenses", result)
        );

        sendTotal(user.id);
    });

    socket.on("updateExpense", data => {
        const user = verifyToken(data.token);
        if (!user) return;

        db.query(
            "UPDATE expenses SET title=?, amount=? WHERE id=?",
            [data.title, data.amount, data.id],
            (err5, result5) => {
                socket.emit("message", "Updated");
                db.query(
                    "SELECT * FROM expenses WHERE user_id=?",
                    [user.id],
                    (err6, rows) => socket.emit("expenses", rows)
                );

                sendTotal(user.id);
            }
        );
    });

    socket.on("deleteExpense", data => {
        const user = verifyToken(data.token);
        if (!user) return;

        db.query(
            "DELETE FROM expenses WHERE id=?",
            [data.id],
            (err7, result7) => {
                socket.emit("message", "Deleted");
                db.query(
                    "SELECT * FROM expenses WHERE user_id=?",
                    [user.id],
                    (err8, rows) => socket.emit("expenses", rows)
                );

                sendTotal(user.id);
                console.log("Expense deleted");
            }
        );
    });
});

server.listen(8043, (err) =>{
    if (err) {
        console.log(err);
    }
    console.log("Server running on http://localhost:8043")
});
