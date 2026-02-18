console.log("Hello");

fetch('/recipes')
    .then(response => responses.json())
    .then(data => {
        console.log(data);
    });