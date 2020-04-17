
let transactions = [];
let myChart;
let offlineTransactions = [];
let db;
let dbReq = indexedDB.open('myDatabase', 1);

dbReq.onupgradeneeded = function(event) {
  // Set the db variable to our database so we can use it!  
  db = event.target.result;

  // Create an object store named notes. Object stores
  // in databases are where data are stored.
  let notes = db.createObjectStore('budget', {autoIncrement: true});
}
dbReq.onsuccess = function(event) {
  db = event.target.result;

  getBudget(db);
 

}

dbReq.onerror = function(event) {
  alert('error opening database ' + event.target.errorCode);
}

//add budget function that is going to save things in the db
function addBudget(db, description, value) {
  // Start a database transaction and get the notes object store
  let tx = db.transaction(['budget'], 'readwrite');
  let store = tx.objectStore('budget');

  // Put the sticky note into the object store
  let entry = {name: description, value: value, date: Date.now()};
  store.add(entry);

  // Wait for the database transaction to complete
  tx.oncomplete = function() { console.log('stored note!') }
  tx.onerror = function(event) {
    alert('error storing note ' + event.target.errorCode);
  }
}


//retrieves the budget stored in the indexDB and inserts it in the back end and finally fetches this data
function getBudget(db){
  let tx = db.transaction(['budget'], 'readonly');
  let store = tx.objectStore('budget');
  let req = store.getAll();
  req.onsuccess = function(event) {
    let note = event.target.result;
  
    if (note) {
      offlineTransactions = [...note];
     
      fetch("/api/transaction/bulk", {
        method: "POST",
        body: JSON.stringify(offlineTransactions),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json"
        }
      }).then(response => {
          return response.json();
          
      }).then(final=>{
        console.log(final);
        initPopulate();
      }).catch(err=> console.log("The internet is not back on homie"));
     
    } else {
      console.log("note 1 not found")
    }
  }
  req.onerror = function(event) {
    alert('error getting note 1 ' + event.target.errorCode);
  }
}


function initPopulate() {
  fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
 
    transactions = data;
  
    populateTotal();
    populateTable();
    populateChart();

    //Delete indexedDB such that it can be created each time a user is offline
    let req = indexedDB.deleteDatabase('myDatabase');
    req.onsuccess = function () {
      console.log("Information successfully transfered to database");
    };
    req.onerror = function () {
        console.log("Information could not be transferred ");
    };
    req.onblocked = function () {
        console.log("You are blocked to perform this action");
    };
  });
}



function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
   addBudget(db, transaction.name,transaction.value, transaction.date)

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};
