import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [".next/**", "node_modules/**", "prisma/dev.db", "prisma/dev.db-journal"],
  },
];

export default config;
