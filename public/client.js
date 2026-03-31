const token = localStorage.getItem("token");
if (!token) {
    window.location.href = "login.html";
}

const list = document.getElementById("list");
const title = document.getElementById("title");
const amount = document.getElementById("amount");
const editId = document.getElementById("editId");
const total = document.getElementById("total");
const expenseCount = document.getElementById("expenseCount");
const largestExpense = document.getElementById("largestExpense");
const summaryDate = document.getElementById("summaryDate");
const emptyState = document.getElementById("emptyState");
const appStatus = document.getElementById("appStatus");
const formHeading = document.getElementById("formHeading");
const saveButton = document.getElementById("saveButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const logoutButton = document.getElementById("logoutButton");

let expenses = [];

const socket = io();

saveButton.addEventListener("click", saveExpense);
cancelEditButton.addEventListener("click", resetForm);
logoutButton.addEventListener("click", logout);

[title, amount].forEach(field => {
    field.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            saveExpense();
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

function saveExpense() {
    const expenseTitle = title.value.trim();
    const expenseAmount = amount.value.trim();

    if (editId && editId.value) {
        socket.emit("updateExpense", {
            id: editId.value,
            title: expenseTitle,
            amount: expenseAmount,
            token
        });
        setStatus("Updating expense...");
    } else if (expenseTitle && expenseAmount) {
        socket.emit("addExpense", {
            title: expenseTitle,
            amount: expenseAmount,
            category: "General",
            token
        });
        setStatus("Saving expense...");
    } else {
        setStatus("Enter both title and amount.");
        return;
    }

    resetForm();
}

socket.emit("getExpenses", token);

socket.on("expenses", data => {
    expenses = Array.isArray(data) ? data : [];
    renderExpenses(expenses);
    updateStats(expenses);
    updateSummaryTime();
});

function editExpense(id, t, a) {
    editId.value = id;
    title.value = t;
    amount.value = a;
    formHeading.textContent = "Edit expense";
    saveButton.textContent = "Update Expense";
    cancelEditButton.classList.remove("hidden");
    setStatus("Editing selected expense.");
    title.focus();
}

function deleteExpense(id) {
    socket.emit("deleteExpense", { id, token });
    setStatus("Deleting expense...");
}

socket.on("totalAmount", t => {
    total.innerText = formatAmount(t || 0);
});

function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

function resetForm() {
    editId.value = "";
    title.value = "";
    amount.value = "";
    formHeading.textContent = "Add a new expense";
    saveButton.textContent = "Save Expense";
    cancelEditButton.classList.add("hidden");
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

        const actions = document.createElement("div");
        actions.className = "expense-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "expense-action edit";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => editExpense(item.id, item.title, item.amount));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "expense-action delete";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteExpense(item.id));

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);

        li.appendChild(copy);
        li.appendChild(actions);
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
