/**
 * SillyTavern server plugin: Fish Audio TTS proxy
 * Forwards requests to https://api.fish.audio from the ST backend,
 * bypassing browser CORS restrictions.
 *
 * Uses node-fetch (bundled with SillyTavern) instead of the built-in fetch,
 * so that SillyTavern's `requestProxy` setting in config.yaml is honored.
 *
 * Routes (mounted at /api/plugins/fishaudio):
 *   POST /models   { apiKey, endpoint? }            -> JSON list of own voice models
 *   POST /generate { apiKey, endpoint?, model, ... } -> audio bytes
 */

import fetch from 'node-fetch';

const DEFAULT_ENDPOINT = 'https://api.fish.audio';

function sanitizeEndpoint(endpoint) {
    const value = String(endpoint || DEFAULT_ENDPOINT).trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(value)) {
        throw new Error('Invalid endpoint');
    }
    return value;
}

export const info = {
    id: 'fishaudio',
    name: 'Fish Audio TTS Proxy',
    description: 'Backend proxy for the Fish Audio TTS API (bypasses browser CORS).',
};

/**
 * @param {import('express').Router} router
 */
export async function init(router) {
    // List the user's own voice models
    router.post('/models', async (req, res) => {
        try {
            const { apiKey, endpoint } = req.body ?? {};
            if (!apiKey) {
                return res.status(400).json({ error: 'apiKey is required' });
            }
            const base = sanitizeEndpoint(endpoint);
            const response = await fetch(`${base}/model?self=true&page_size=100`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });
            const text = await response.text();
            if (!response.ok) {
                console.error('[fishaudio] /models upstream error:', response.status, text);
                return res.status(response.status).send(text);
            }
            res.type('application/json').send(text);
        } catch (error) {
            console.error('[fishaudio] /models failed:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    // Generate speech
    router.post('/generate', async (req, res) => {
        try {
            const {
                apiKey,
                endpoint,
                model = 's2-pro',
                text,
                reference_id,
                temperature = 0.7,
                top_p = 0.7,
                speed = 1.0,
                volume = 0,
                normalize = true,
                latency = 'normal',
                format = 'mp3',
                mp3_bitrate = 128,
                chunk_length = 200,
            } = req.body ?? {};

            if (!apiKey) {
                return res.status(400).json({ error: 'apiKey is required' });
            }
            if (!text) {
                return res.status(400).json({ error: 'text is required' });
            }

            const base = sanitizeEndpoint(endpoint);
            const response = await fetch(`${base}/v1/tts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'model': String(model),
                },
                body: JSON.stringify({
                    text: String(text),
                    reference_id: reference_id || null,
                    temperature: Number(temperature),
                    top_p: Number(top_p),
                    prosody: { speed: Number(speed), volume: Number(volume) },
                    chunk_length: Number(chunk_length),
                    normalize: Boolean(normalize),
                    format: String(format),
                    mp3_bitrate: Number(mp3_bitrate),
                    latency: String(latency),
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('[fishaudio] /generate upstream error:', response.status, errText);
                return res.status(response.status).send(errText);
            }

            const contentTypes = { mp3: 'audio/mpeg', wav: 'audio/wav', pcm: 'audio/L16', opus: 'audio/ogg' };
            res.setHeader('Content-Type', contentTypes[format] ?? 'application/octet-stream');

            const buffer = Buffer.from(await response.arrayBuffer());
            res.send(buffer);
        } catch (error) {
            console.error('[fishaudio] /generate failed:', error);
            res.status(500).json({ error: String(error) });
        }
    });

    console.log('[fishaudio] Server plugin loaded. Routes: /api/plugins/fishaudio/{models,generate}');
}

export async function exit() {}

export default { info, init, exit };
