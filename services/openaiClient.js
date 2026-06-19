async function callOpenAIJson(messages) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { error: 'missing_api_key' };
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data.error?.message || 'Erreur OpenAI';
        throw new Error(message);
    }

    const content = data.choices?.[0]?.message?.content || '{}';
    return { data: JSON.parse(content) };
}

module.exports = {
    callOpenAIJson
};
