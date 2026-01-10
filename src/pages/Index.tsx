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

      // Handle errors from the edge function
      if (error) {
        console.error('Edge function error:', error);
        
        // Try to extract error message from the response
        let errorMessage = '';
        
        // The error context may contain the response body
        if (error.context && typeof error.context === 'object') {
          try {
            const responseBody = await (error.context as Response).json?.();
            errorMessage = responseBody?.error || '';
          } catch {
            // Fallback to error message
            errorMessage = error.message || '';
          }
        } else {
          errorMessage = error.message || '';
        }
        
        // Check for guest limit reached (403 with specific message)
        const isGuestLimitError = 
          errorMessage.toLowerCase().includes('guest free generation already used') ||
          errorMessage.toLowerCase().includes('guest free') ||
          errorMessage.toLowerCase().includes('free generation already used');
        
        if (isGuestLimitError) {
          setIsGuestBlocked(true);
          setErrorMsg(''); // Clear error to show CTA instead
          return;
        }
        
        // Check for not enough credits
        if (errorMessage.toLowerCase().includes('not enough credits')) {
          setErrorMsg("You don't have enough credits. Please top up or upgrade your plan.");
          setIsGuestBlocked(false);
          return;
        }
        
        // Generic error
        setErrorMsg('Something went wrong. Please try again.');
        setIsGuestBlocked(false);
        return;
      }

      // Check for error in response body
      if (responseData?.error) {
        const errorMessage = responseData.error;
        
        const isGuestLimitError = 
          errorMessage.toLowerCase().includes('guest free generation already used') ||
          errorMessage.toLowerCase().includes('guest free') ||
          errorMessage.toLowerCase().includes('free generation already used');
        
        if (isGuestLimitError) {
          setIsGuestBlocked(true);
          setErrorMsg('');
          return;
        }
        
        if (errorMessage.toLowerCase().includes('not enough credits')) {
          setErrorMsg("You don't have enough credits. Please top up or upgrade your plan.");
          setIsGuestBlocked(false);
          return;
        }
        
        setErrorMsg('Something went wrong. Please try again.');
        setIsGuestBlocked(false);
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
      setIsGuestBlocked(false);
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
      
      {(recipe || isLoading || errorMsg || isGuestBlocked) && (
        <div ref={resultRef}>
          <RecipeCard 
            recipe={recipe || { title: '', ingredients: [] }} 
            onGenerateAnother={handleGenerateAnother}
            isLoading={isLoading}
            errorMsg={errorMsg}
            onRetry={handleRetry}
            isLoggedIn={isLoggedIn}
            isGuestBlocked={isGuestBlocked}
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
