export default {
    content: ['./index.html', './src/**/*.{js,jsx}'],
    theme: {
        extend: {
            colors: {
                ink: { 900: '#0a0f1c', 800: '#111a2c', 700: '#16223a', 600: '#1c2740' },
                line: '#223049',
            },
            keyframes: {
                'pulse-alert': {
                    '0%,100%': { opacity: 1 },
                    '50%': { opacity: 0.45 },
                },
                'slide-in': {
                    from: { opacity: 0, transform: 'translateY(-6px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                },
            },
            animation: {
                'pulse-alert': 'pulse-alert 1s ease-in-out infinite',
                'slide-in': 'slide-in 0.25s ease-out',
            },
        },
    },
    plugins: [],
};
