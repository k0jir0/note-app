console.log('Hello');

fetch('/notes')
    .then(response => response.json())
    .then(data => {
        console.log(data);
    });
