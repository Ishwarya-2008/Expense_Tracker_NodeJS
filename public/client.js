const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

const list = document.getElementById("list");
const title = document.getElementById("title");
const amount = document.getElementById("amount");
const total = document.getElementById("total");
const expenseCount = document.getElementById("expenseCount");
const largestExpense = document.getElementById("largestExpense");
const summaryDate = document.getElementById("summaryDate");
const emptyState = document.getElementById("emptyState");
const appStatus = document.getElementById("appStatus");
const saveButton = document.getElementById("saveButton");
const logoutButton = document.getElementById("logoutButton");

let expenses = [];

const socket = io();

saveButton.addEventListener("click", addExpense);
logoutButton.addEventListener("click", logout);

[title, amount].forEach(field => {
    field.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            addExpense();
        }
    });
});

socket.on('unauthorized', info => {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
});

socket.on("message", message => {
    setStatus(message);
});

function addExpense() {
    const expenseTitle = title.value.trim();
    const expenseAmount = amount.value.trim();

    if (expenseTitle && expenseAmount) {
        socket.emit("addExpense", {
            title: expenseTitle,
            amount: expenseAmount,
            category: "General",
            token
        });
        setStatus("Saving expense...");
        title.value = "";
        amount.value = "";
    } else {
        setStatus("Enter both title and amount.");
    }
}

socket.emit("getExpenses", token);

socket.on("expenses", data => {
    expenses = Array.isArray(data) ? data : [];
    renderExpenses(expenses);
    updateStats(expenses);
    updateSummaryTime();
});

socket.on("totalAmount", t => {
    total.innerText = formatAmount(t || 0);
});

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

function renderExpenses(items) {
    list.innerHTML = "";

    if (!items.length) {
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");

    items.forEach(item => {
        const li = document.createElement("li");
        li.className = "expense-item";

        const copy = document.createElement("div");
        copy.className = "expense-copy";

        const titleText = document.createElement("strong");
        titleText.textContent = item.title;

        const metaText = document.createElement("p");
        metaText.textContent = `Amount: Rs.${formatAmount(item.amount)}`;

        copy.appendChild(titleText);
        copy.appendChild(metaText);

        li.appendChild(copy);
        list.appendChild(li);
    });
}

function updateStats(items) {
    expenseCount.textContent = items.length;

    const largest = items.reduce((max, item) => {
        const numericAmount = Number(item.amount) || 0;
        return numericAmount > max ? numericAmount : max;
    }, 0);

    largestExpense.textContent = `Rs.${formatAmount(largest)}`;
}

function updateSummaryTime() {
    summaryDate.textContent = `Updated ${new Date().toLocaleString()}`;
}

function setStatus(message) {
    appStatus.textContent = message || "";
}

function formatAmount(value) {
    const numeric = Number(value) || 0;
    return numeric.toFixed(2);
}
