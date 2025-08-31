const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        blue: {
          500: { value: '#3b82f6' },
          600: { value: '#2563eb' },
        },
        gray: {
          50: { value: '#f9fafb' },
          100: { value: '#f3f4f6' },
          200: { value: '#e5e7eb' },
          600: { value: '#4b5563' },
          700: { value: '#374151' },
        },
        red: { 500: { value: '#ef4444' } },
        green: { 500: { value: '#10b981' } },
        white: { value: '#ffffff' },
      },
    },
    // Component recipes - this is what actually styles your components
    recipes: {
      button: {
        base: {
          px: '4',
          py: '2',
          borderRadius: 'md',
          fontWeight: 'medium',
          cursor: 'pointer',
        },
        variants: {
          variant: {
            solid: {
              bg: 'blue.500',
              color: 'white',
              _hover: { bg: 'blue.600' },
            },
            outline: {
              border: '1px solid',
              borderColor: 'gray.200',
              bg: 'white',
              _hover: { bg: 'gray.50' },
            },
          },
          colorScheme: {
            blue: { bg: 'blue.500', _hover: { bg: 'blue.600' } },
            red: { bg: 'red.500' },
            green: { bg: 'green.500' },
            gray: { bg: 'gray.600' },
          },
        },
        defaultVariants: {
          variant: 'solid',
          colorScheme: 'blue',
        },
      },
    },
  },
});

export default config;
