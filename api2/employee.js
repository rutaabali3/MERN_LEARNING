// Employee collection function
function employeeCollection(db) {

    // employees collection
    return db.collection("employees");
}


// Function export
module.exports = employeeCollection;