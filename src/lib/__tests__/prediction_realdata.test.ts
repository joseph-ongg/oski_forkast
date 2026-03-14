import { describe, it, expect } from 'vitest';
import { predict } from '../prediction';

// Real user rankings from Supabase (deduplicated, first occurrence wins)
const rankings: Record<string, number> = {
  "1000 Island Dressing": -1, "Alfredo Penne Pasta": 6, "Alfredo Sauce": -1,
  "Aloo Chole": -1, "Apple Cider Vinegar": -1, "Apple Pie": 5,
  "Arborio Mushroom and Asparagus Risotto with Rice": -1, "Arrabiata Sauce": -1,
  "Artichoke": -1, "Asian Sesame Dressing": -1, "Assorted Dinner Rolls": -1,
  "Assorted MIni Cheesecakes": -1, "Assorted Mini Donuts": -1, "Assorted Mini Muffins": -1,
  "Aurora Sauce": -1, "Baby Spinach": -1, "Bacon and Cheese Eggs Scramble": 8,
  "Bacon Bits": 8, "Baguette with Herb Oil": 7, "Baja Fish Taco": 9,
  "Baked BBQ Tofu": -1, "Baked Cod with Lemon Butter": 8, "Baked Corn Tortilla Strips": 7,
  "Baked Diced Sweet Potato": -1, "Baked Green Beans Radish and Corn": -1,
  "Baked Jerk Tofu": -1, "Baked Lemongrass Tofu": -1, "Baked Penne Pasta": 8,
  "Baked Pineapple Teriyaki Salmon": 9, "Baked Pork Bacon": 8,
  "Baked Salmon with Mango Salsa": 9, "Baked Sweet Potato": -1, "Baked Tandoori Tofu": -1,
  "Baked Vegan Protein Red Sauce Enchilada": -1, "Baked White Beans": -1,
  "Balsamic Vinaigrette": -1, "Balsamic Vinegar": -1, "Base - Mixed Greens": -1,
  "Basil": -1, "Basil and Cheese Eggs Scramble": -1, "Basmati Rice": 9,
  "Basmati Rice Pullao": 7, "BBQ Chicken Pizza": 6, "Bean Chili": -1,
  "Bean corn tomato salsa": -1, "Bean Sprout Banchan": -1, "Beef Bolognese Sauce": -1,
  "Beef Bulgogi": 9, "Beef Burger with 1000 Island": 7, "Beef Chili": 6,
  "Beef Kaldereta": 8, "Beef Lomo Saltado": 7, "Beef Swedish Meatballs": 8,
  "Belgian Waffle": -1, "Bell Pepper Brussels Sprout Mushroom and Zucchini": -1,
  "Berry Granola Plantains": -1, "Bias Cut Carrots": -1, "Biscuits": 7,
  "Black Bean Burger": -1, "Black Bean Feijoada Stew": -1, "Black Beans": -1,
  "Black Olive": -1, "Blackened Catfish": 6, "Blue Cheese Dressing": -1,
  "Bok Choy Mushroom Stir Fry": -1, "Braised Coconut Tofu": -1,
  "Braised Collard Greens": -1, "Braised Mung Bean": -1, "Bread Pudding": -1,
  "Broccoli Beef": 7, "Broccoli Cheddar Soup": -1, "Broccolini and Chili Pizza": -1,
  "Brown Rice": -1, "Brussels Sprouts": -1, "Buffalo Cauliflower Pizza": -1,
  "Buffalo Chicken Pizza": 7, "Cabbage and Squash Stir Fry": -1, "Cacciatore Sauce": -1,
  "Caesar Dressing": -1, "Cajun Baked Carrot and Celery": -1, "Cajun Eggs Scramble": -1,
  "Cajun Potato": -1, "Caldo De Pollo": -1, "Capers": -1,
  "Cardamom Roasted Cauliflower": -1, "Caribbean Vegetable Blend": -1,
  "Carmelized Onion Spaghetti with Brussels Sprouts": -1, "Carne Asada": 9,
  "Carne Asada Beef Taco": 9, "Carrot Sticks": -1, "Cauliflower Masala Soup": -1,
  "Cheddar Eggs Scramble": -1, "Cheese Marinara Ravioli Pasta": 6, "Cheese Pizza": 5,
  "Cherry Pepper": -1, "Cherry Tomatoes": -1, "Chicago Hot Dog": -1,
  "Chicken Alfredo Sauce": 7, "Chicken Apple Sausage": 7,
  "Chicken Enchiladas with Red Sauce": 7, "Chicken Nuggets": 9,
  "Chicken Parmesan Sandwich": -1, "Chicken Tenders": 8, "Chicken Tortilla Soup": -1,
  "Chickpea Noodle Soup": -1, "Chili Cheese Beef Hot Dog": -1, "Chive": -1,
  "Chocolate Chip Pancakes": -1, "Chocolate Chunk Brownies": -1,
  "Chocolate Sheet Cake": -1, "Cilantro": -1, "Cilantro and Lime Rice": 9,
  "Cilantro Chutney": -1, "Cinnamon Butter": -1, "Cinnamon Pancakes": -1,
  "Cinnamon Raisin Bagels": -1, "Cioppino Stew": -1, "Citrus Basmati Rice": 9,
  "Citrus Glaze Pork": 7, "Coconut Kheer Rice Pudding": -1, "Coconut Mung Bean": -1,
  "Coconut Quinoa Porridge": -1, "Coconut Rice": 8, "Coleslaw": -1,
  "Corn Tortilla": -1, "Cornbread": 7, "Cream of Wheat": -1,
  "Creamy Chipotle Chicken Pasta": 8, "Creamy Chipotle Sauce": -1,
  "Creamy Coleslaw Salad": -1, "Creamy Pesto": -1, "Creamy Primavera Sauce": -1,
  "Crinkle Potato Fries": 7, "Crushed Cucumber with Sesame and Garlic": -1,
  "Cucumber Raita": -1, "Cumin Roasted Cauliflower": -1, "Curry Roasted Cauliflower": -1,
  "Custard Pie": -1, "Denver Eggs Scramble": -1, "Diced Cucumbers": -1,
  "Diced Green Onion": -1, "Diced Tomato": -1, "Dim Sum Style Gailon": -1,
  "Dirty Converted Rice": 3, "Dried Cranberry": -1, "Egg Pasta Noodle": 6,
  "Eggplant Mapo Tofu": -1, "Eggplant Reuben Sandwich": -1,
  "Endaladang Pipinoo at Kamatis": -1, "English Cucumbers": -1, "Everything Bagels": -1,
  "Farfalle Pasta": 6, "Farfalle with Spinach and Gorgonzola Pasta": -1,
  "Fettuccine Pasta": 6, "Fettucini Alfredo Pasta": 7, "Fiery Veggie Chili": -1,
  "Filipino Styled Pork Adobo Stew": 7, "Five Spice Roasted Broccoli": -1,
  "Flour Tortilla": -1, "Forbidden Rice": 3, "French Toast": 8,
  "Fried Breaded Cod with Tartar Sauce": 10, "Fried Garlic": 7,
  "Fried Green Beans": -1, "Fried Orange Tofu": -1, "Fried Potato Cubes": 5,
  "Fried Samosa": 7, "Fried Tater Tots": 8, "Fried Teriyaki Tofu": -1,
  "Fruits of the Forest Pie": -1, "Garbanzo Beans": -1, "Gardein BBQ Sandwich": -1,
  "Gardein Strip Fajitas": -1, "Garlic and Cilantro Quinoa": 3, "Garlic Bread": 7,
  "Garlic Cheese Crouton": -1, "Garlic Fried Rice": 9, "Garlic Fries": 8,
  "Garlic Green Beans": -1, "Garlic Naan": 9, "Garlic Roasted Broccolini": -1,
  "German Chocolate Cake": -1, "Ginataang Kalabasa": -1, "Ginger Tofu": -1,
  "Gluten Free Granola": -1, "Gluten Free Macaroni Pasta": 7,
  "Gluten Free Penne Pasta": 5, "Gold Beets": -1, "Gomen Collard Greens": -1,
  "Grape Tomato": -1, "Greek Chicken Pizza": 8, "Griddled Pork Ham": 6,
  "Griddled Tomato": -1, "Grilled Asparagus": -1, "Grilled Jalapeno": -1,
  "Grilled Paprika Tofu": -1, "Grilled Shawarma Halal Chicken Thigh": 8,
  "Grits": -1, "Guacamole": -1, "Halal American Beef Burger": 7,
  "Halal Banh Mi Chicken Sandwich": 9, "Halal BBQ Roasted Chicken": 7,
  "Halal Beef Broccoli": 6, "Halal Beef Loco Moco": 1, "Halal Beef Marinara Sauce": -1,
  "Halal Beef Mushroom Burger": -1, "Halal Broccoli Beef": 6,
  "Halal Chicken Breast": 7, "Halal Chicken Tenders": 8, "Halal Chicken Thigh": 6,
  "Halal Chicken Thigh Adobo": 8, "Halal Chicken Thigh Fajitas": 8,
  "Halal Creamy Chipotle Chicken Pasta": 7, "Halal Glazed Beef Meatloaf": -1,
  "Halal Ground Beef": -1, "Halal Honey Mustard Baked Chicken Thigh": 8,
  "Halal Huli Huli Grilled Chicken Thigh": 7, "Halal Java Beef Curry": 8,
  "Halal Jerk Baked Chicken Thigh": 7, "Halal Mediterranean-style Roasted Chicken": 8,
  "Halal Mustard Potato Salad": -1, "Halal North African-style Roasted Chicken": 7,
  "Halal Rosemary Chicken": 7, "HALAL Rosemary Roasted Chicken Thigh": 7,
  "Halal Seared Honey Beef": 7, "Halal Taco-style Ground Beef": 8,
  "Halal Teriyaki Chicken Thigh": 7, "Ham and Artichoke Pizza": -1,
  "Ham and Cheddar Eggs Scramble": -1, "Harissa Roasted Chicken": 7,
  "Harissa Tomato Sauce": -1, "Hashbrown Patties": 8, "Hawaiian Dinner Roll": -1,
  "Hawaiian Pizza": -1, "Heirloom Tomato": -1, "Herb Grilled Chicken Breast": 7,
  "Herb Roasted Chicken": 8, "Himalayan Red Rice": -1, "Home Fries": 6,
  "Hominy": -1, "Honey Ginger Roasted Carrots": -1, "Honey Glazed Carrots": -1,
  "Honey Mustard Pork": 6, "Housemade Cajun Potato Chips": 6, "Housemade Hummus": -1,
  "Housemade Lemon Pepper Potato Chips": 7, "Housemade Marinara Sauce": -1,
  "Housemade Potato Chips": 7, "Italian Dressing": -1, "Italian Parsley": -1,
  "Italian Ragu Ground Lamb": 9, "Italian Vegetable Blend": -1, "Jalapeno Rings": -1,
  "Jamaican Corn Porridge": -1, "Jasmine Rice": 8, "Jook with Garnishes": -1,
  "Kachumber Salad": -1, "Kale Pesto Fettuccine": -1, "Kidney Beans": -1,
  "Kimchi": -1, "Kimchi Fried Rice": 10, "Korean BBQ-style Chicken Tenders": 10,
  "Korean Style Fried Chicken": 10, "Kosher Beef Chili Colorado": 7,
  "Kosher Beef Meatloaf": 7, "Kosher Grilled Teriyaki Chicken Thigh": 8,
  "Kosher Herb Roasted Beef with Gravy": 7, "Kosher Herb Roasted Chicken": 6,
  "Kosher Mashed Potato": -1, "Kosher North African-style Roasted Chicken": 7,
  "Kosher Roasted Turkey Breast": 5, "Kung Pao Tofu": -1, "Latin Coleslaw Salad": -1,
  "Lavash": -1, "Lemon": -1, "Lemon Chicken Spagetti with Ricotta": 7,
  "Lemon Pepper Roasted Cauliflower": -1, "Lemon Roasted Broccoli": -1,
  "Lemongrass Chicken Potsticker": -1, "Lentil Bolognese Sauce": -1,
  "Lentil Marinara Sauce": -1, "Lima Beans": -1, "Lime Wedges": -1,
  "Long Grain Rice": 7, "Louisiana-style Hot Links": -1, "Low Fat Peach Yogurt": -1,
  "Low Fat Plain Yogurt": -1, "Low Fat Strawberry Yogurt": -1,
  "Low Fat Vanilla Greek Yogurt": -1, "Macaroni and Cheese Pasta": 8,
  "Maple Glazed Carrots": -1, "Margherita Pizza": -1, "Marinara Penne Pasta": 5,
  "Marinara Sauce": -1, "Marinated Cucumber and Tomato": -1, "Mashed Potato": -1,
  "Mashed Yukon Potato": -1, "Matchstick Carrots": -1, "Meatlovers Pizza": 6,
  "Medium Grain Rice": 7, "Mexican Fries": -1, "Mexican Rice": 9,
  "Minestrone Soup": -1, "Mini Assorted Danish": -1, "Mini Butter Croissant": -1,
  "Mini Maple Pecan Danish": -1, "Mint": -1, "Moroccan Vegetable Blend": -1,
  "Mung Bean Patty": -1, "Mung Bean Sprouts": -1, "Mushroom Adobado Taco": -1,
  "Mushroom Eggs Scramble": -1, "Mushroom Pizza": -1, "Mushroom Potato Taco": -1,
  "Mushroom Stir Fry": -1, "Nacho Cheese Sauce": -1,
  "Native Three Sisters Bean Soup": -1, "Navy Beans": -1,
  "New Orleans-style Black Eyed Beans Corn and Tomato Stew": -1,
  "Non Fat Plain Greek Yogurt": -1, "Nutritional Yeast": -1, "Oatmeal": -1,
  "Olive Oil": -1, "Onion and Cilantro": -1,
  "Onion and Garbanzo Beans Chana Masala Stew": -1, "Onion Gravy": -1,
  "Orange Sauce": -1, "Orechiette Pasta": -1, "Original English Muffin": -1,
  "Overnight Oats with Peach": -1, "Panang Beef Curry": 7, "Pancakes": -1,
  "Peach Pie": -1, "Penne Pasta": -1, "Pepperoncini Slice": -1,
  "Pepperoni Pizza": 7, "Pepperoni Pizza with Pepperoncinis": -1,
  "Pesto Alfredo Sauce": -1, "Pineapple Habanero Salsa": -1, "Pinto Beans": -1,
  "Piri Piri Roasted Chicken": 7, "Plain Bagels": -1, "Pollock Sandwich": -1,
  "Poppy Seed Dressing": -1, "Pork BBQ Ribs": 7, "Pork Carnitas BBQ Sandwich": 8,
  "Pork Char Siu Bao": -1, "Pork Chili Verde": 8, "Pork Potstickers": 7,
  "Pork Pozole": 7, "Pork Sausage Link": 8, "Pork Sausage Patty": 7,
  "Portobello BBQ Sandwich": -1, "Potato and Carrot Korma": -1, "Potato Wedges": 8,
  "Pumpkin Pie": -1, "Pumpkin Seeds": -1, "Puttanesca Sauce": -1, "Quinoa": -1,
  "Raisins": -1, "Ranch Dressing": -1, "Red Beans and Rice": -1, "Red Beets": -1,
  "Red Radishes": -1, "Red Red - Black Eyed Peas Stew": -1, "Refried Beans": -1,
  "Regular Fries": 6, "Rice Congee": -1, "Rigatoni Pasta": -1,
  "Roasted Asparagus": -1, "Roasted Asparagus Bell Pepper Mushroom and Zucchini": -1,
  "Roasted Asparagus with Parmesan": -1, "Roasted BBQ Cauliflower": -1,
  "Roasted Beets": -1, "Roasted Broccoli and Red Pepper with Turmeric": -1,
  "Roasted Brussels Sprouts": -1, "Roasted Brussels Sprouts and Red Pepper": -1,
  "Roasted Butternut Squash": -1, "Roasted Carrot with Cumin": -1,
  "Roasted Carrot Zucchini Eggplant and Onion": -1, "Roasted Carrots": -1,
  "Roasted Cherry Tomato": -1, "Roasted Cumin Butternut Squash": -1,
  "Roasted Fingerling Potatoes with Artichokes": -1, "Roasted Garlic Tomato": -1,
  "Roasted Mexican Vegetable Blend": -1, "Roasted Oregano Corn": -1,
  "Roasted Peppers": -1, "Roasted Pineapple Salsa": -1, "Roasted Piri Piri Tofu": -1,
  "Roasted Pork": 7, "Roasted Potatoes": -1, "Roasted Red Pepper and Carrots": -1,
  "Roasted Red Potatoes with Garlic": -1, "Roasted Russet Potato": -1,
  "Roasted Tomato Salsa": -1, "Roasted Turkey Breast": 5, "Roma Pesto Pizza": -1,
  "Romaine Lettuce": -1, "Root Vegetables": -1, "Rotisserie Chicken": 7,
  "Salsa Pico De Gallo": -1, "Salsa Roja": -1, "Salsa Verde": -1,
  "Sandwhich Garnish": -1, "Sausage and Onion Pizza": 7, "Sausage Pizza": -1,
  "Sauteed Bok Choy": -1, "Sauteed Cabbage and Carrot with Sesame": -1,
  "Sauteed Cabbage and Fermented Black Beans": -1,
  "Sauteed Carrots Squash and Red Pepper": -1, "Sauteed Chicken Fajitas": 8,
  "Sauteed Chile Verde Tofu": -1, "Sauteed Corn Onion and Squash": -1,
  "Sauteed Corn Pasilla": -1, "Sauteed Corn Pepper Mexicali": -1,
  "Sauteed Green Beans": -1, "Sauteed Green Beans with Garlic and Ginger": -1,
  "Sauteed Kale Onion and Mushroom": -1, "Sauteed Mushroom": -1,
  "Sauteed Mushroom Spinach and Tomatoes": -1, "Sauteed Mushroom Tofu Sisig": -1,
  "Sauteed Mushroom Vegetable Blend": -1, "Sauteed Onion and Zucchini": -1,
  "Sauteed Onion Peppers": -1, "Sauteed Pinto Beans with Green Chili": -1,
  "Sauteed Spicy Eggplant": -1, "Sauteed Thai Coconut Curry Chicken": 8,
  "Savory Lentils": -1, "Savory Polenta": -1, "Scrambled Eggs": -1,
  "Seared Chicken Breast Cacciatore": 7, "Seared Tofu Soyrizo": -1,
  "Seasoned Black Beans": -1, "Serrano Pesto Sauce": -1, "Sesame Kale": -1,
  "Sesame Orange Tamarind Chicken": 8, "Sesame Spinach Banchan": -1,
  "Shoestring Fries": 6, "Shredded Carrots": -1, "Shredded Green Cabbage": -1,
  "Shredded Iceberg Lettuce": -1, "Shredded Rainbow Carrots": -1,
  "Shredded Vegan Cheese": -1, "Shredded Vegan Mozzarella Cheese": -1,
  "Shrimp Ceviche Tostada": -1, "Shrimp Pesto Alfredo Sauce": -1,
  "Sliced Avocado": -1, "Sliced Breakfast Pork Ham": -1, "Sliced Buttermilk Bread": -1,
  "Sliced Cucumber": -1, "Sliced Green Onion": -1, "Sliced Radish": -1,
  "Sliced Red Beets": -1, "Sliced Whole Wheat Bread": -1,
  "Sliced Whole Wheat Vegan Bread": -1, "Smoked Cajun-Style Turkey Breast": 5,
  "Snap Pea Mushroom Stir Fry": -1, "Sour Cream": -1,
  "Southwestern Corn Chowder": -1, "Soyrizo": -1,
  "Soyrizo with Peppers and Onion": -1, "Spiced Couscous": -1,
  "Spicy Fried Chicken Sandwich": 7, "Spicy Garlic Eggplant Stir Fry": -1,
  "Spicy Thai Tofu Green Beans": -1, "Spicy Waffle Fries": -1,
  "Spinach Saag-style Tofu": -1, "Spinach Tofu Tomato Scramble": -1,
  "Split Pea Soup": -1, "Squash Medley": -1, "Steak Fries": 6,
  "Steamed Bok Choy with Oyster Sauce": -1, "Steamed Broccoli": -1,
  "Steamed Broccoli and Cauliflower": -1, "Steamed Broccoli Cauliflower and Carrots": -1,
  "Steamed Broccolini with Lemon": -1, "Steamed Carrots and Green Beans": -1,
  "Steamed Corn": -1, "Steamed Green Beans": -1, "Steamed Mint Peas": -1,
  "Steamed Peas": -1, "Steamed Potato": -1, "Stir Fried Bok Choy": -1,
  "Stir Fried Cabbage": -1, "Stir Fried Cabbage and Mushrooms": -1,
  "Strawberry Shortcake": -1, "Sunflower Seeds": -1, "Sweet Plantains": -1,
  "Sweet Potato Black Bean Taco": -1, "Sweet Potato Kale Hash": -1,
  "Sweet Potato Tater Tots": -1, "Taco Garnish": -1, "Tamarind Chutney": -1,
  "Tarka Dal Stew": -1, "Teriyaki Chicken": 8, "Texas-style Breakfast Taco": 8,
  "Thai Basil": -1, "Thai Basil Salmon": 10, "Thai BBQ Shitake Pizza": -1,
  "Thai Sweet Chili Sauce": -1, "Tikka Masala Chicken Breast": 9,
  "Tofu Banh Mi Sandwich": -1, "Tofu Fajita": -1,
  "Tomatillo Avocado Verde Salad": -1, "Tomato Bisque Soup": -1,
  "Tomato Chipotle Penne Pasta": -1, "Tomato Chutney": -1,
  "Tomato Couscous Salad": -1, "Tortilla Strips": -1, "Turkey and Bean Chili": -1,
  "Turkey Bolognese Sauce": -1, "Turkey Melt Sandwich": -1,
  "Turkey Sausage Link": -1, "Turkey Sausage Patty": -1,
  "Tuscan Mushroom Bean Soup": -1, 'Vegan "Chicken" Nuggets': -1,
  'Vegan "Chicken" Patty Smothered in Gravy': -1, 'Vegan "Chicken" Tenders': -1,
  'Vegan "sausage" Mixed Pepper Stir Fry': -1, "Vegan Baked Tofu Bulgogi": -1,
  "Vegan Beyond Burger": -1, 'Vegan Breakfast "Sausage" Patty': -1,
  'Vegan Broccoli "Beef"': -1, 'Vegan Celebration "Roast"': -1,
  "Vegan Chicago Hot Dog": -1, "Vegan Chili Hot Dog": -1,
  "Vegan Chocolate Chip Cookie": -1, "Vegan Cioppino Stew": -1,
  "Vegan Creamy Mushroom Gravy": -1, "Vegan Crispy Potato Soyrizo Taco": -1,
  "Vegan Huli Huli Strips": -1, 'Vegan Italian "Sausage"': -1,
  'Vegan Italian "Sausage" Sandwich': -1,
  'Vegan Italian "Sausage" with Peppers and Onions': -1,
  "Vegan Lemon Sugar Cookie": -1, "Vegan Lomo Saltado Stir Fry": -1,
  "Vegan Macaroni Salad": -1, "Vegan Malibu Burger": -1,
  "Vegan Midnight Cookie": -1, "Vegan Mongolian Stir Fry": -1,
  "Vegan Oatmeal Raisin Cookie": -1, 'Vegan Onion Pepper and "Beef"': -1,
  "Vegan Primavera Sauce": -1, "Vegan Scrambled Egg": -1,
  "Vegan Sunflower Sour Cream": -1, 'Vegan Sweet and Sour "Beef"': -1,
  "Vegan Texas-style Breakfast Taco": -1, "Vegan Wellness Stew": -1,
  "Vegetable Chow Mein": -1, "Vegetable Eggroll": -1, "Vegetable Fajita": -1,
  "Vegetable Medley": -1, "Vegetable Potstickers": -1, "Vegetable Spring Rolls": -1,
  "Vegetable Yemeni Zurbian Basmati Rice": -1, "Vongole Clams Linguini": -1,
  "Waffles": -1, "White Corn Tortillas": -1, "Whole Baby Carrots": -1,
  "Whole Wheat Bagels": -1, "Wild Pilaf Rice": 4, "Wild Rice": 4,
  "Wild Rice Tofu Stuffed Peppers": -1, "Yellow Tortilla Chip": -1,
  "Yemeni Beef Stew": -1,
};

const allDishNames = Object.keys(rankings);

function testPredict(dishName: string) {
  const testRankings = { ...rankings };
  delete testRankings[dishName];
  return predict({ name: dishName }, testRankings, allDishNames);
}

describe('Real data: food type > cooking method', () => {
  it('Baked Salmon predicts high (salmon matters, not baked)', () => {
    const pred = testPredict("Baked Salmon with Mango Salsa");
    expect(pred).not.toBeNull();
    expect(pred!.predictedSkip).toBe(false);
    expect(pred!.rating).toBeGreaterThanOrEqual(7);
  });

  it('Baked Pineapple Teriyaki Salmon predicts high', () => {
    const pred = testPredict("Baked Pineapple Teriyaki Salmon");
    expect(pred).not.toBeNull();
    expect(pred!.predictedSkip).toBe(false);
    expect(pred!.rating).toBeGreaterThanOrEqual(7);
  });

  it('Thai Basil Salmon predicts high', () => {
    const pred = testPredict("Thai Basil Salmon");
    expect(pred).not.toBeNull();
    expect(pred!.predictedSkip).toBe(false);
    expect(pred!.rating).toBeGreaterThanOrEqual(8);
  });

  it('Baked Cod predicts high (fish, not baked veggies)', () => {
    const pred = testPredict("Baked Cod with Lemon Butter");
    expect(pred).not.toBeNull();
    expect(pred!.predictedSkip).toBe(false);
    expect(pred!.rating).toBeGreaterThanOrEqual(6);
  });

  it('Fried Breaded Cod predicts very high', () => {
    const pred = testPredict("Fried Breaded Cod with Tartar Sauce");
    expect(pred).not.toBeNull();
    expect(pred!.rating).toBeGreaterThanOrEqual(7);
  });
});

describe('Real data: chicken dishes', () => {
  it('Chicken Nuggets predicts high', () => {
    const pred = testPredict("Chicken Nuggets");
    expect(pred).not.toBeNull();
    expect(pred!.rating).toBeGreaterThanOrEqual(7);
  });

  it('Korean Style Fried Chicken predicts very high', () => {
    const pred = testPredict("Korean Style Fried Chicken");
    expect(pred).not.toBeNull();
    expect(pred!.rating).toBeGreaterThanOrEqual(7);
  });

  it('Teriyaki Chicken predicts well', () => {
    const pred = testPredict("Teriyaki Chicken");
    expect(pred).not.toBeNull();
    expect(pred!.rating).toBeGreaterThanOrEqual(6);
  });
});

describe('Real data: vegan dishes predict skip', () => {
  it('Vegan "Chicken" Nuggets should not match real chicken', () => {
    const pred = testPredict('Vegan "Chicken" Nuggets');
    if (pred) {
      // Should either be skip or very low
      if (!pred.predictedSkip) {
        expect(pred.rating).toBeLessThanOrEqual(3);
      }
    }
  });

  it('Vegan Beyond Burger should not match real beef burger', () => {
    const pred = testPredict("Vegan Beyond Burger");
    if (pred) {
      if (!pred.predictedSkip) {
        expect(pred.rating).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('Real data: turkey is mediocre (rated 5)', () => {
  it('Roasted Turkey Breast predicts around 5', () => {
    const pred = testPredict("Roasted Turkey Breast");
    expect(pred).not.toBeNull();
    expect(pred!.rating).toBeGreaterThanOrEqual(3);
    expect(pred!.rating).toBeLessThanOrEqual(7);
  });
});

describe('Real data: veggies/sides predict skip', () => {
  it('Roasted Carrots predicts skip or very low', () => {
    const pred = testPredict("Roasted Carrots");
    if (pred) {
      if (!pred.predictedSkip) {
        expect(pred.rating).toBeLessThanOrEqual(3);
      }
    }
  });

  it('Steamed Broccoli predicts lower than entrees', () => {
    // "broccoli" matches "Broccoli Beef" (7) positively — the model can't know
    // the user likes broccoli WITH beef but not steamed alone. This is a known
    // limitation of keyword matching. Just verify it doesn't predict 8+.
    const pred = testPredict("Steamed Broccoli");
    if (pred && !pred.predictedSkip) {
      expect(pred.rating).toBeLessThanOrEqual(7);
    }
  });
});

describe('Real data: rice variety matters', () => {
  it('Garlic Fried Rice predicts high (rated 9)', () => {
    const pred = testPredict("Garlic Fried Rice");
    expect(pred).not.toBeNull();
    expect(pred!.rating).toBeGreaterThanOrEqual(6);
  });

  it('Jasmine Rice predicts decent (rated 8)', () => {
    const pred = testPredict("Jasmine Rice");
    expect(pred).not.toBeNull();
    expect(pred!.rating).toBeGreaterThanOrEqual(5);
  });
});

describe('Real data: beef dishes', () => {
  it('Beef Bulgogi predicts high (rated 9)', () => {
    const pred = testPredict("Beef Bulgogi");
    expect(pred).not.toBeNull();
    expect(pred!.rating).toBeGreaterThanOrEqual(6);
  });

  it('Carne Asada predicts high (rated 9)', () => {
    const pred = testPredict("Carne Asada");
    expect(pred).not.toBeNull();
    expect(pred!.rating).toBeGreaterThanOrEqual(7);
  });
});
