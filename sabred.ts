import { basename } from "https://deno.land/std@0.147.0/path/mod.ts";
import { Confirm } from "https://deno.land/x/cliffy@v0.20.1/prompt/mod.ts";

const rocketEmoji = "🚀"
const infoEmoji = "❕"
const errorEmoji = "❌"

interface SabreConfig {
    lan: boolean,
    lanPingDelay: number
}

const parseOrNull = (content: string): SabreConfig | null => {
    try {
        return JSON.parse(content) as SabreConfig
    } catch {
        return null
    }
}

const config = parseOrNull(await Deno.readTextFile("./sabre-config.json"))

if (!config?.lan) {
    const shouldAddLan = await Confirm.prompt("No LAN property was found in the config. Would you like to add it?")

    if (shouldAddLan) {
        await Deno.writeTextFile("./sabre-config.json", JSON.stringify({ ...config, ...{ lan: true, lanPingDelay: 0.5 } }))
    }
}

const findSabreJar = async (): Promise<string | null> => {	

    let bestVersionScore = 0
    let chosenFile: string | null = null

    for await (const dirEntry of Deno.readDir(Deno.cwd())) {

        if (dirEntry.isDirectory) continue

        if (!dirEntry.name.endsWith(".jar")) continue

        // Get the sum of all the character codes
        const score = dirEntry.name.split("").map(it => it.charCodeAt(0)).reduce((a, b) => a + b)

        if (score > bestVersionScore) {
            bestVersionScore = score
            chosenFile = dirEntry.name
        }
    }

    return chosenFile
}

const jar = await findSabreJar()

if (jar == null) {
    console.log(errorEmoji, `%cCould not find any files with .jar in the current working directory.`, "color: red")
    Deno.exit(1)
}

console.log(infoEmoji, `%cUsing jar ${basename(jar)}`, "color: blue")

const grabSabreCommand = async (): Promise<Deno.Process> => {
    console.log("")
    console.log(rocketEmoji, `%cStarting sabre...`, "color: blue")

    // Kill any existing process on the port.
    const killCommand = Deno.run({ 
        cmd: ["fuser", "-k", "25565/tcp"],
        stderr: "piped"
    })

    await killCommand.status()

    return Deno.run({
        cmd: ["java", "-Xmx2024M", "-Xms2024M", "-jar", jar],
        clearEnv: false
    })
}

let currentCommand: Deno.Process | null = null
await Deno.mkdir("./extensions", { recursive: true });

const watch = async () => {

    console.log(rocketEmoji, "%cWatching ./extensions, ./sabre-config.json", "color: blue")
    
    const watcher = Deno.watchFs(["./extensions", "./sabre-config.json"]);

    for await (const event of watcher) {
        if (event.kind === "modify" || event.kind === "create") {
            currentCommand?.kill("SIGTERM")
            continue
        }
    }
}

watch()

while(true) {
    const command = await grabSabreCommand()

    currentCommand = command

    const status = await command.status()

    if (status.code !== 0) {
        console.log(errorEmoji, `%cCommand exited with exit code ${status.code}.`, "color: red")
    }
}