const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const recipeRoute = require('./src/routes/recipeRoutes');

require('dotenv').config();
const app = express();

//Model layer
const dbURI = process.env.MONGODB_URI;
if (!dbURI) {
    console.error('Missing MONGODB_URI. Set it in your environment or a .env file.');
    process.exit(1);
}
mongoose.connect(dbURI)
    .then(() => {
        console.log("Connected to MongoDB");
    }).catch((err) => {
        console.log("Error connecting to MongoDB:", err);
    });

// mongoose connection  
//mongoose.connect("mongodb+srv://ryanadmin:<circuitstream26>@cluster0.09wsom9.mongodb.net/?appName=Cluster0");

const recipes = require('./src/models/recipes');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

app.use(express.static(path.join(__dirname, 'src', 'views', 'public')));

app.get('/', async (req, res) => {
    try {
        const recipeList = await recipes.find({});
        res.render('pages/home', { title: 'Recipe Picker App', recipes: recipeList });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// app.get('/recipe/:name', (req, res) => {
//     const recipeName = decodeURIComponent(req.params.name);
//     const recipe = recipes.find(r => r.name === recipeName);

//     if (!recipe) {
//         return res.status(404).send('Recipe not found');
//     }

//     res.render('pages/recipe', { recipe });
// });

app.get('/seed', async (req, res) => {
    await recipes.deleteMany({});

    await recipes.create([
        {
            name: 'Spaghetti Bolognese',
            description: 'Classic Italian meat sauce.',
            ingredients: ['Spaghetti', 'Ground Beef', 'Tomato Sauce', 'Onion'],
            instructions: ['Boil pasta', 'Cook meat', 'Mix sauce'],
            prepTime: 15,
            cookTime: 30,
            image: 'https://images.unsplash.com/photo-1626844131082-256783844137?w=600',
            isFavorite: true
        },
        {
            name: 'Vegetable Stir Fry',
            description: 'Healthy and quick veggies.',
            ingredients: ['Broccoli', 'Carrots', 'Soy Sauce', 'Tofu'],
            instructions: ['Chop veggies', 'Fry tofu', 'Stir fry all'],
            prepTime: 10,
            cookTime: 15,
            image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600',
            isFavorite: false
        }
    ]);

    res.send('Database seeded');
}); 

app.use('/', recipeRoute);

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

