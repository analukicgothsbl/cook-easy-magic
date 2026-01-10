import { useState, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { RecipeForm, type RecipeFormData } from '@/components/RecipeForm';
import { RecipeCard, type Recipe } from '@/components/RecipeCard';
import { ComparisonSection } from '@/components/ComparisonSection';
import { ImageGallery } from '@/components/ImageGallery';
import { TrustSection } from '@/components/TrustSection';
import { Footer } from '@/components/Footer';
import { useGuestMode } from '@/hooks/useGuestMode';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isGuestBlocked, setIsGuestBlocked] = useState(false);
  const [lastFormData, setLastFormData] = useState<RecipeFormData | null>(null);
  
  const formRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const { guestId, isLoggedIn, isLoading: guestLoading } = useGuestMode();

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
      // Build payload
      const payload = {
        ...data,
        guest_id: isLoggedIn ? null : guestId,
      };

      console.log('Recipe generation payload:', payload);

      // Call the edge function
      const { data: responseData, error } = await supabase.functions.invoke('generate-recipe', {
        body: payload,
      });

      if (error) {
        console.error('Edge function error:', error);
        const errorMessage = error.message || 'Something went wrong. Please try again.';
        
        if (errorMessage.includes('Not enough credits')) {
          setErrorMsg("You don't have enough credits. Please top up.");
        } else if (errorMessage.includes('Guest free generation already used')) {
          setErrorMsg("You already used the free guest recipe. Please sign up to continue.");
          setIsGuestBlocked(true);
        } else {
          setErrorMsg(errorMessage);
        }
        return;
      }

      // Check for error in response body
      if (responseData?.error) {
        const errorMessage = responseData.error;
        
        if (errorMessage.includes('Not enough credits')) {
          setErrorMsg("You don't have enough credits. Please top up.");
        } else if (errorMessage.includes('Guest free generation already used')) {
          setErrorMsg("You already used the free guest recipe. Please sign up to continue.");
          setIsGuestBlocked(true);
        } else {
          setErrorMsg(errorMessage);
        }
        return;
      }

      // Success - set recipe data
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
    scrollToForm();
  };

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <HeroSection onCtaClick={scrollToForm} />
      
      <div ref={formRef}>
        <RecipeForm 
          onSubmit={handleFormSubmit} 
          isLoading={isLoading} 
          isRegistered={isLoggedIn}
          isGuestBlocked={isGuestBlocked}
        />
      </div>
      
      {(recipe || isLoading || errorMsg) && (
        <div ref={resultRef}>
          <RecipeCard 
            recipe={recipe || { title: '', ingredients: [] }} 
            onGenerateAnother={handleGenerateAnother}
            isLoading={isLoading}
            errorMsg={errorMsg}
            onRetry={handleRetry}
            isLoggedIn={isLoggedIn}
          />
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
