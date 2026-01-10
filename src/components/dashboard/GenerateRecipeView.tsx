import { useState, useRef } from 'react';
import { RecipeForm, type RecipeFormData } from '@/components/RecipeForm';
import { RecipeCard, type Recipe } from '@/components/RecipeCard';
import { supabase } from '@/integrations/supabase/client';

export function GenerateRecipeView() {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastFormData, setLastFormData] = useState<RecipeFormData | null>(null);
  
  const resultRef = useRef<HTMLDivElement>(null);

  const scrollToResult = () => {
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleFormSubmit = async (data: RecipeFormData) => {
    setLastFormData(data);
    setIsLoading(true);
    setErrorMsg('');
    setRecipe(null);
    setRecipeId(null);
    scrollToResult();

    try {
      const payload = {
        ...data,
        guest_id: null, // Logged in user
      };

      const { data: responseData, error } = await supabase.functions.invoke('generate-recipe', {
        body: payload,
      });

      if (error) {
        let errorMessage = '';
        
        if (error.context && typeof error.context === 'object') {
          try {
            const responseBody = await (error.context as Response).json?.();
            errorMessage = responseBody?.error || '';
          } catch {
            errorMessage = error.message || '';
          }
        } else {
          errorMessage = error.message || '';
        }
        
        if (errorMessage.toLowerCase().includes('not enough credits')) {
          setErrorMsg("You don't have enough credits. Please top up or upgrade your plan.");
          return;
        }
        
        setErrorMsg('Something went wrong. Please try again.');
        return;
      }

      if (responseData?.error) {
        const errorMessage = responseData.error;
        
        if (errorMessage.toLowerCase().includes('not enough credits')) {
          setErrorMsg("You don't have enough credits. Please top up or upgrade your plan.");
          return;
        }
        
        setErrorMsg('Something went wrong. Please try again.');
        return;
      }

      if (responseData?.recipe) {
        setRecipeId(responseData.recipe_id);
        setRecipe(responseData.recipe);
      } else {
        setErrorMsg('Failed to generate recipe. Please try again.');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setErrorMsg('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFormData) {
      handleFormSubmit(lastFormData);
    }
  };

  const handleGenerateAnother = () => {
    setRecipe(null);
    setRecipeId(null);
    setErrorMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="max-w-4xl mx-auto">
        <RecipeForm 
          onSubmit={handleFormSubmit} 
          isLoading={isLoading} 
          isRegistered={true}
          isGuestBlocked={false}
        />
      </div>
      
      {(recipe || isLoading || errorMsg) && (
        <div ref={resultRef} className="max-w-4xl mx-auto">
          <RecipeCard 
            recipe={recipe || { title: '', ingredients: [] }} 
            recipeId={recipeId || undefined}
            onGenerateAnother={handleGenerateAnother}
            isLoading={isLoading}
            errorMsg={errorMsg}
            onRetry={handleRetry}
            isLoggedIn={true}
            isGuestBlocked={false}
          />
        </div>
      )}
    </div>
  );
}
