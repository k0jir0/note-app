fetch('/notes')
    .then(response => response.json())
    .then(() => {
        // Handle notes data
    })
    .catch(() => {
        // Handle error
    });
