const apiKey = 'AIzaSyAmazjoYMrcMo2yDNPjcD9bbtmxpfGidYY';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function run() {
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            data.models.forEach(m => {
                if (m.name.includes("imagen") || m.supportedGenerationMethods?.includes("predict")) {
                    console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods?.join(",")})`);
                }
            });
        } else {
            console.log("Error:", data);
        }
    } catch (e) {
        console.error("Fetch error:", e);
    }
}
run();
