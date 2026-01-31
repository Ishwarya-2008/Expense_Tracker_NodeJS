const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

const list = document.getElementById("list");
const title = document.getElementById("title");
const amount = document.getElementById("amount");
const editId = document.getElementById("editId");
const total = document.getElementById("total");

const socket = io();

socket.on('unauthorized', info => {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
});

function saveExpense() {
    if (editId && editId.value) {
        socket.emit("updateExpense", {
            id: editId.value,
            title: title.value,
            amount: amount.value,
            token
        });
        editId.value = "";
    } else if (title.value && amount.value) {
        socket.emit("addExpense", {
            title: title.value,
            amount: amount.value,
            category: "General",
            token
        });
    } else {
        return;
    }

    title.value = "";
    amount.value = "";
}

socket.emit("getExpenses", token);

socket.on("expenses", data => {
    const listData = Array.isArray(data) ? data : [];
    list.innerHTML = listData.map(e => `
        <li class="expense-item">
            <span class="expense-text">
                ${e.title} - ₹${e.amount}
            </span>

            <div class="btn-group">
                <button onclick="editExpense(${e.id}, '${e.title}', ${e.amount})">
                    Edit
                </button>
                <button onclick="deleteExpense(${e.id})">
                    Delete
                </button>
            </div>
        </li>
    `).join("");
});


function editExpense(id, t, a) {
    editId.value = id;
    title.value = t;
    amount.value = a;
}

function deleteExpense(id) {
    socket.emit("deleteExpense", { id, token });
}

socket.on("totalAmount", t => {
    total.innerText = t || 0;
});

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}
