fetch('/notes')
    .then(response => response.json())
    .then(data => {
        // Handle notes data
    })
    .catch(error => {
        // Handle error
    });
