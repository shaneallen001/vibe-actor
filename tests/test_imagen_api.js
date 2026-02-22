const apiKey = 'AIzaSyAmazjoYMrcMo2yDNPjcD9bbtmxpfGidYY';
const model = "imagen-4.0-generate-001";
const prompt = "A cute fluffy cat";

const requestBody = {
    instances: [
        { prompt: prompt }
    ],
    parameters: {
        sampleCount: 1,
        aspectRatio: "1:1"
    }
};

async function run() {
    try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        const data = await resp.json();
        console.log("Status:", resp.status);
        console.log("Response data keys:", Object.keys(data));
        console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    } catch (e) {
        console.error(e);
    }
}
run();
