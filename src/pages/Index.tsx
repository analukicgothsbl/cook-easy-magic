import { useState, useRef } from 'react';
import { HeroSection } from '@/components/HeroSection';
import { RecipeForm, RecipeFormData } from '@/components/RecipeForm';
import { RecipeCard, Recipe } from '@/components/RecipeCard';
import { ComparisonSection } from '@/components/ComparisonSection';
import { ImageGallery } from '@/components/ImageGallery';
import { TrustSection } from '@/components/TrustSection';
import { Footer } from '@/components/Footer';

// Sample recipes for demo (in production this would come from an API)
const sampleRecipes: Record<string, Recipe> = {
  breakfast: {
    title: 'Golden Potato & Egg Scramble',
    mealType: 'Breakfast',
    time: '15 minutes',
    cuisine: 'Surprise me',
    servings: 2,
    ingredients: [
      '3 eggs',
      '2 medium potatoes, diced',
      '1 small onion, chopped',
      '2 cloves garlic, minced',
      '2 tbsp olive oil',
      'Salt and pepper to taste',
      'Fresh herbs (optional)',
    ],
    steps: [
      'Dice the potatoes into small cubes and boil until just tender, about 8 minutes. Drain well.',
      'Heat olive oil in a large pan over medium-high heat. Add potatoes and cook until golden, about 5 minutes.',
      'Add onion and garlic, sauté for 2 minutes until fragrant.',
      'Push potatoes to the side, crack eggs into the pan and scramble with the potatoes.',
      'Season with salt and pepper. Serve hot with fresh herbs if desired.',
    ],
    tip: 'For extra crispy potatoes, make sure they are completely dry before frying and don\'t overcrowd the pan.',
  },
  lunch: {
    title: 'Quick Garlic Chicken with Potatoes',
    mealType: 'Lunch',
    time: '25 minutes',
    cuisine: 'Surprise me',
    servings: 4,
    ingredients: [
      '500g chicken breast, cubed',
      '4 medium potatoes, quartered',
      '1 onion, sliced',
      '4 cloves garlic, minced',
      '3 tbsp olive oil',
      '1 tsp paprika',
      'Salt and pepper to taste',
      'Fresh parsley for garnish',
    ],
    steps: [
      'Parboil potatoes for 10 minutes until slightly tender. Drain and set aside.',
      'Season chicken with salt, pepper, and paprika. Heat oil in a large pan over medium-high heat.',
      'Cook chicken until golden on all sides, about 5-6 minutes. Remove and set aside.',
      'In the same pan, add potatoes and onion. Cook until golden, about 8 minutes.',
      'Add garlic and cook for 1 minute. Return chicken to the pan and toss everything together.',
      'Serve hot, garnished with fresh parsley.',
    ],
    tip: 'Let the chicken rest for a few minutes before serving to keep it juicy.',
  },
  dinner: {
    title: 'Hearty Chicken & Potato Stew',
    mealType: 'Dinner',
    time: '40 minutes',
    cuisine: 'Surprise me',
    servings: 4,
    ingredients: [
      '500g chicken thighs, bone-in',
      '4 large potatoes, cubed',
      '2 onions, roughly chopped',
      '6 cloves garlic, whole',
      '4 cups chicken broth',
      '2 tbsp olive oil',
      '1 tsp dried thyme',
      'Salt and pepper to taste',
    ],
    steps: [
      'Season chicken with salt, pepper, and thyme. Heat oil in a large pot and brown chicken on all sides. Remove and set aside.',
      'In the same pot, sauté onions until softened, about 5 minutes. Add garlic and cook for another minute.',
      'Add potatoes and chicken broth. Bring to a boil, then reduce heat to simmer.',
      'Return chicken to the pot. Cover and cook for 25-30 minutes until chicken is cooked through and potatoes are tender.',
      'Adjust seasoning and serve hot in deep bowls.',
    ],
    tip: 'This stew tastes even better the next day as the flavors have time to meld together.',
  },
  snack: {
    title: 'Crispy Garlic Potato Bites',
    mealType: 'Snack',
    time: '20 minutes',
    cuisine: 'Surprise me',
    servings: 2,
    ingredients: [
      '3 medium potatoes, diced small',
      '4 cloves garlic, minced',
      '1/4 onion, finely diced',
      '3 tbsp olive oil',
      '1/2 tsp smoked paprika',
      'Salt to taste',
      'Fresh chives for topping',
    ],
    steps: [
      'Boil diced potatoes until just fork-tender, about 8 minutes. Drain and pat dry thoroughly.',
      'Heat olive oil in a pan over medium-high heat. Add potatoes in a single layer.',
      'Let them crisp without stirring for 3-4 minutes, then toss and repeat until golden all over.',
      'Add onion and garlic, sauté for 2 minutes. Season with paprika and salt.',
      'Transfer to a plate and top with fresh chives. Serve immediately.',
    ],
    tip: 'The secret to crispy potatoes is making sure they are completely dry before frying.',
  },
};

const Index = () => {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToResult = () => {
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleFormSubmit = (data: RecipeFormData) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const selectedRecipe = sampleRecipes[data.mealType.toLowerCase()] || sampleRecipes.lunch;
      setRecipe(selectedRecipe);
      setIsLoading(false);
      scrollToResult();
    }, 1500);
  };

  const handleGenerateAnother = () => {
    setRecipe(null);
    scrollToForm();
  };

  return (
    <main className="min-h-screen bg-background">
      <HeroSection onCtaClick={scrollToForm} />
      
      <div ref={formRef}>
        <RecipeForm onSubmit={handleFormSubmit} isLoading={isLoading} />
      </div>
      
      {recipe && (
        <div ref={resultRef}>
          <RecipeCard recipe={recipe} onGenerateAnother={handleGenerateAnother} />
        </div>
      )}
      
      <ComparisonSection />
      <ImageGallery />
      <TrustSection />
      <Footer />
    </main>
  );
};

export default Index;
