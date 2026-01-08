import { motion } from 'framer-motion';
import { useRef } from 'react';
import cookingPrep from '@/assets/cooking-prep.jpg';
import familyDinner from '@/assets/family-dinner.jpg';
import breakfast from '@/assets/breakfast.jpg';
import foodPasta from '@/assets/food-pasta.jpg';

const galleryItems = [
  { image: cookingPrep, caption: 'Use what you have' },
  { image: foodPasta, caption: 'Cook fast' },
  { image: familyDinner, caption: 'Share with family' },
  { image: breakfast, caption: 'Start your day right' },
];

export const ImageGallery = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section className="py-16 overflow-hidden bg-cream-dark/30">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8 px-4"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground font-serif mb-2">
          Everyday Cooking Made Simple
        </h2>
        <p className="text-muted-foreground">
          From kitchen to table in minutes
        </p>
      </motion.div>

      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 px-4 sm:px-8 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {galleryItems.map((item, index) => (
          <motion.div
            key={item.caption}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="flex-shrink-0 snap-center"
          >
            <div className="relative w-64 sm:w-72 h-80 sm:h-96 rounded-2xl overflow-hidden group">
              <img
                src={item.image}
                alt={item.caption}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                <p className="text-primary-foreground font-semibold text-lg">
                  {item.caption}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
