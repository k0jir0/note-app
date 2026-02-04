const express = require('express');
const path = require('path');

const app = express();

const recipes = require('./src/models/recipes');

const recipeController = require('./src/controllers/recipe');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

app.use(express.static(path.join(__dirname, 'src', 'views', 'public')));

app.get('/', (req, res) => {
    res.render('pages/home', {title: 'Recipe Picker App', recipes: recipes});
});

app.get('/recipe/:name', (req, res) => {
    const recipeName = decodeURIComponent(req.params.name);
    const recipe = recipes.find(r => r.name === recipeName);

    if (!recipe) {
        return res.status(404).send('Recipe not found');
    }

    res.render('pages/recipe', { recipe });
});

app.use('/recipe', recipeController);

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

