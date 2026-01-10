import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const initializeUserData = async (userId: string, name: string) => {
    // Create user_extended record with role
    const { error: extendedError } = await supabase
      .from('user_extended')
      .insert({
        user_id: userId,
        name: name,
        role: 'cook_master' as const,
      });

    if (extendedError) {
      console.error('Error creating user_extended:', extendedError);
    }


    // Create credit_usage record for signup bonus
    const { error: usageError } = await supabase
      .from('credit_usage')
      .insert({
        user_id: userId,
        recipe_id: null,
        type: 'income',
        amount: 5,
        reason: 'signup_bonus',
      });

    if (usageError) {
      console.error('Error creating credit_usage:', usageError);
    }

    // Create credit_bonus record
    const { error: bonusError } = await supabase
      .from('credit_bonus')
      .insert({
        user_id: userId,
        daily_bonus: 1,
        usage: 0,
      });

    if (bonusError) {
      console.error('Error creating credit_bonus:', bonusError);
    }

    // Create credit_wallet record
    const { error: walletError } = await supabase
      .from('credit_wallet')
      .insert({
        user_id: userId,
        balance: 5,
        daily_remaining: 1,
      });

    if (walletError) {
      console.error('Error creating credit_wallet:', walletError);
    }

    // Create user_options record with specified defaults
    const { error: optionsError } = await supabase
      .from('user_options')
      .insert({
        user_id: userId,
        cuisine: null,
        meal_category: null,
        time_available: null,
        difficulty: null,
        kids_friendly: false,
        budget_level: null,
        servings: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (optionsError) {
      console.error('Error creating user_options:', optionsError);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            display_name: name,
          },
        },
      });

      if (error) {
        return { error };
      }

      // If user was created successfully, initialize all related tables
      if (data.user) {
        await initializeUserData(data.user.id, name);
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return { error };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
