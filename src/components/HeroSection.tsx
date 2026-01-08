import { motion } from "framer-motion";
import { ChefHat } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const floatingIngredients = [
  { name: "🥚 Eggs", delay: 0 },
  { name: "🍅 Tomatoes", delay: 0.5 },
  { name: "🍗 Chicken", delay: 1 },
  { name: "🧄 Garlic", delay: 1.5 },
  { name: "🥔 Potatoes", delay: 2 },
];

interface HeroSectionProps {
  onCtaClick: () => void;
}

export const HeroSection = ({ onCtaClick }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="w-full h-full"
        >
          <img src={heroBg} alt="Fresh ingredients on kitchen counter" className="w-full h-full object-cover" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-20 container-narrow section-padding text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary font-semibold text-sm">
            <ChefHat className="w-4 h-4" />
            Cook Master
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6 font-serif"
        >
          What Can I <span className="text-gradient">Cook Today?</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-lg sm:text-xl text-foreground font-medium max-w-2xl mx-auto mb-4 drop-shadow-md"
        >
          Enter the ingredients you have at home and get a simple recipe in seconds.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="text-sm text-foreground/90 font-medium mb-8 drop-shadow-sm"
        >
          No login required • Free • Made for everyday cooking
        </motion.p>

        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCtaClick}
          className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2"
        >
          🍳 Generate a recipe
        </motion.button>

        {/* Floating Ingredient Chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-12 flex flex-wrap justify-center gap-3"
        >
          {floatingIngredients.map((ingredient, index) => (
            <motion.span
              key={ingredient.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.2 + ingredient.delay * 0.2 }}
              className="floating-chip animate-float"
              style={{ animationDelay: `${index * 0.5}s` }}
            >
              {ingredient.name}
            </motion.span>
          ))}
        </motion.div>
      </div>

      {/* Decorative bottom curve */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" className="w-full">
          <path d="M0 60V20C240 50 480 60 720 45C960 30 1200 10 1440 25V60H0Z" fill="hsl(var(--background))" />
        </svg>
      </div>
    </section>
  );
};
