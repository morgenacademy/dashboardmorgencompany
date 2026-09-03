import { getSharepointFiles } from '../../lib/integrations.mjs';

export const handler = async () => {
  const data = await getSharepointFiles();
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    body: JSON.stringify(data),
  };
};
