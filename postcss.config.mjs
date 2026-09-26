export default {
  plugins: {
    '@tailwindcss/postcss': {},
    // After Tailwind: every color-mix() it wrote becomes rgb() with channels, which Safari 15 reads. docs/11 D-24.
    '@bliss/config/postcss-rgb-alpha': {},
  },
};
