import { getRequestHeaders } from '../../../script.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { FishAudioTtsProvider };

const PLUGIN_BASE = '/api/plugins/fishaudio';

class FishAudioTtsProvider {
    //########//
    // Config //
    //########//

    settings;
    voices = [];
    separator = ' . ';

    audioElement = document.createElement('audio');

    defaultSettings = {
        apiKey: '',
        endpoint: 'https://api.fish.audio',
        model: 's2-pro',
        temperature: 0.7,
        top_p: 0.7,
        speed: 1.0,
        volume: 0,
        normalize: true,
        latency: 'normal',
        format: 'mp3',
        mp3_bitrate: 128,
        chunk_length: 200,
        // Manually added voices, format: "Name=reference_id, Name2=reference_id2"
        custom_voices: '',
        voiceMap: {},
    };

    get settingsHtml() {
        let html = `
        <div class="fishaudio_tts_settings">
            <label for="fishaudio_tts_api_key">API Key</label>
            <input id="fishaudio_tts_api_key" type="text" class="text_pole" placeholder="<API Key>"/>

            <label for="fishaudio_tts_endpoint">Fish Audio Endpoint</label>
            <input id="fishaudio_tts_endpoint" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.endpoint}"/>

            <label for="fishaudio_tts_model">Model</label>
            <select id="fishaudio_tts_model" class="text_pole">
                <option value="s2-pro">S2 Pro</option>
                <option value="s1">S1</option>
            </select>

            <label for="fishaudio_tts_custom_voices">Custom Voices (Name=reference_id, comma separated)</label>
            <input id="fishaudio_tts_custom_voices" type="text" class="text_pole" placeholder="MyVoice=7f92f8afb8ec43bf81429cc1c9199cb1"/>

            <input id="fishaudio_connect" class="menu_button" type="button" value="Connect" />

            <label for="fishaudio_tts_temperature">Temperature: <span id="fishaudio_tts_temperature_output">${this.defaultSettings.temperature}</span></label>
            <input id="fishaudio_tts_temperature" type="range" value="${this.defaultSettings.temperature}" min="0" max="1" step="0.01" />

            <label for="fishaudio_tts_top_p">Top P: <span id="fishaudio_tts_top_p_output">${this.defaultSettings.top_p}</span></label>
            <input id="fishaudio_tts_top_p" type="range" value="${this.defaultSettings.top_p}" min="0" max="1" step="0.01" />

            <label for="fishaudio_tts_speed">Speed: <span id="fishaudio_tts_speed_output">${this.defaultSettings.speed}</span></label>
            <input id="fishaudio_tts_speed" type="range" value="${this.defaultSettings.speed}" min="0.5" max="2" step="0.01" />

            <label for="fishaudio_tts_volume">Volume (dB): <span id="fishaudio_tts_volume_output">${this.defaultSettings.volume}</span></label>
            <input id="fishaudio_tts_volume" type="range" value="${this.defaultSettings.volume}" min="-10" max="10" step="1" />

            <label for="fishaudio_tts_latency">Latency</label>
            <select id="fishaudio_tts_latency" class="text_pole">
                <option value="normal">Normal (best quality)</option>
                <option value="balanced">Balanced</option>
                <option value="low">Low</option>
            </select>

            <label for="fishaudio_tts_normalize" class="checkbox_label">
                <input id="fishaudio_tts_normalize" type="checkbox" ${this.defaultSettings.normalize ? 'checked' : ''}/>
                <span>Normalize text (improves numbers in EN/ZH)</span>
            </label>
            <p>
                Requests are proxied through the "fishaudio" server plugin
                (requires <code>enableServerPlugins: true</code>).
                Voices are loaded from your own Fish Audio voice models.
                To use a public voice from the
                <a href="https://fish.audio/discovery" target="_blank">voice library</a>,
                add its reference ID to "Custom Voices" above.
            </p>
        </div>
        `;
        return html;
    }

    onSettingsChange() {
        this.settings.apiKey = String($('#fishaudio_tts_api_key').val()).trim();
        this.settings.endpoint = String($('#fishaudio_tts_endpoint').val()).replace(/\/$/, '');
        this.settings.model = String($('#fishaudio_tts_model').val());
        this.settings.custom_voices = String($('#fishaudio_tts_custom_voices').val());
        this.settings.temperature = parseFloat(String($('#fishaudio_tts_temperature').val()));
        this.settings.top_p = parseFloat(String($('#fishaudio_tts_top_p').val()));
        this.settings.speed = parseFloat(String($('#fishaudio_tts_speed').val()));
        this.settings.volume = parseInt(String($('#fishaudio_tts_volume').val()), 10);
        this.settings.latency = String($('#fishaudio_tts_latency').val());
        this.settings.normalize = $('#fishaudio_tts_normalize').is(':checked');

        $('#fishaudio_tts_temperature_output').text(this.settings.temperature);
        $('#fishaudio_tts_top_p_output').text(this.settings.top_p);
        $('#fishaudio_tts_speed_output').text(this.settings.speed);
        $('#fishaudio_tts_volume_output').text(this.settings.volume);

        saveTtsProviderSettings();
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length === 0) {
            console.info('Using default Fish Audio TTS Provider settings');
        }

        // Only accept keys defined in defaultSettings
        this.settings = { ...this.defaultSettings, ...settings };

        $('#fishaudio_tts_api_key').val(this.settings.apiKey);
        $('#fishaudio_tts_endpoint').val(this.settings.endpoint);
        $('#fishaudio_tts_model').val(this.settings.model);
        $('#fishaudio_tts_custom_voices').val(this.settings.custom_voices);
        $('#fishaudio_tts_temperature').val(this.settings.temperature);
        $('#fishaudio_tts_top_p').val(this.settings.top_p);
        $('#fishaudio_tts_speed').val(this.settings.speed);
        $('#fishaudio_tts_volume').val(this.settings.volume);
        $('#fishaudio_tts_latency').val(this.settings.latency);
        $('#fishaudio_tts_normalize').prop('checked', this.settings.normalize);

        $('#fishaudio_tts_temperature_output').text(this.settings.temperature);
        $('#fishaudio_tts_top_p_output').text(this.settings.top_p);
        $('#fishaudio_tts_speed_output').text(this.settings.speed);
        $('#fishaudio_tts_volume_output').text(this.settings.volume);

        $('#fishaudio_connect').on('click', () => { this.onConnectClick(); });
        $('#fishaudio_tts_api_key').on('input', () => { this.onSettingsChange(); });
        $('#fishaudio_tts_endpoint').on('input', () => { this.onSettingsChange(); });
        $('#fishaudio_tts_model').on('change', () => { this.onSettingsChange(); });
        $('#fishaudio_tts_custom_voices').on('input', () => { this.onSettingsChange(); });
        $('#fishaudio_tts_temperature').on('input', () => { this.onSettingsChange(); });
        $('#fishaudio_tts_top_p').on('input', () => { this.onSettingsChange(); });
        $('#fishaudio_tts_speed').on('input', () => { this.onSettingsChange(); });
        $('#fishaudio_tts_volume').on('input', () => { this.onSettingsChange(); });
        $('#fishaudio_tts_latency').on('change', () => { this.onSettingsChange(); });
        $('#fishaudio_tts_normalize').on('change', () => { this.onSettingsChange(); });

        try {
            await this.checkReady();
            console.debug('Fish Audio TTS: Settings loaded');
        } catch {
            console.debug('Fish Audio TTS: Settings loaded, but not ready');
        }
    }

    async checkReady() {
        this.voices = await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        this.voices = await this.fetchTtsVoiceObjects();
    }

    async onConnectClick() {
        try {
            await this.checkReady();
            toastr.success(`Fish Audio: loaded ${this.voices.length} voice(s)`);
            this.onSettingsChange();
        } catch (error) {
            toastr.error(`Fish Audio: ${error}`);
        }
    }

    //###################//
    //  Helper Functions //
    //###################//

    getCustomVoices() {
        // Parse "Name=id, Name2=id2"
        return String(this.settings.custom_voices || '')
            .split(',')
            .map(s => s.trim())
            .filter(s => s.includes('='))
            .map(s => {
                const idx = s.indexOf('=');
                return {
                    name: s.slice(0, idx).trim(),
                    voice_id: s.slice(idx + 1).trim(),
                    preview_url: false,
                    lang: 'zh-CN',
                };
            })
            .filter(v => v.name && v.voice_id);
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    async getVoice(voiceName) {
        if (this.voices.length === 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.find(v => v.name === voiceName);
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('zh-CN');
        const response = await this.fetchTtsGeneration(text, voiceId);

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    //###########//
    // API CALLS //
    //###########//

    async fetchTtsVoiceObjects() {
        if (!this.settings.apiKey) {
            throw 'API key not set';
        }
        const response = await fetch(`${PLUGIN_BASE}/models`, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                apiKey: this.settings.apiKey,
                endpoint: this.settings.endpoint,
            }),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        const responseJson = await response.json();
        const ownVoices = (responseJson.items ?? []).map(model => ({
            name: model.title,
            voice_id: model._id,
            preview_url: false,
            lang: (model.languages && model.languages[0]) || 'zh-CN',
        }));
        return [...ownVoices, ...this.getCustomVoices()];
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);
        const response = await fetch(`${PLUGIN_BASE}/generate`, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                apiKey: this.settings.apiKey,
                endpoint: this.settings.endpoint,
                model: this.settings.model,
                text: inputText,
                reference_id: voiceId,
                temperature: Number(this.settings.temperature),
                top_p: Number(this.settings.top_p),
                speed: Number(this.settings.speed),
                volume: Number(this.settings.volume),
                normalize: Boolean(this.settings.normalize),
                latency: this.settings.latency,
                format: this.settings.format,
                mp3_bitrate: Number(this.settings.mp3_bitrate),
                chunk_length: Number(this.settings.chunk_length),
            }),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }

    // Interface not used by Fish Audio
    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }
}
