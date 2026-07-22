import { getAiNews } from '../../lib/integrations.mjs';

export const handler = async () => {
  const data = await getAiNews();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
    body: JSON.stringify(data),
  };
};
