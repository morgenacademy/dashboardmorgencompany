import { getNetlifySites } from '../../lib/integrations.mjs';

export const handler = async () => {
  const data = await getNetlifySites();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=120' },
    body: JSON.stringify(data),
  };
};
