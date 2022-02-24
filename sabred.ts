import { colors } from "https://deno.land/x/cliffy@v0.20.1/ansi/colors.ts";
import { basename } from "https://deno.land/std@0.126.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.126.0/fs/mod.ts";
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
        await Deno.writeTextFile("./sabre-config.json", JSON.stringify(Object.assign(config, { lan: true, lanPingDelay: 0.5 })))
    }
}

const findSabreJar = async (): Promise<string | null> => {	

    let bestVersionScore = 0
    let chosenFile: string | null = null

    for await (const dirEntry of Deno.readDir(Deno.cwd())) {
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
    console.log(errorEmoji, colors.red(`Could not find any files with .jar in the current working directory.`))
    Deno.exit(1)
}

console.log(infoEmoji, colors.blue(`Using jar ${basename(jar)}`))

const grabSabreCommand = async (): Promise<Deno.Process> => {
    console.log("")
    console.log(rocketEmoji, colors.blue(`Starting sabre...`))

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

ensureDir("./extensions")

const watch = async() => {

    console.log(rocketEmoji, colors.brightBlue("Watching ./extensions, ./sabre-config.json"))
    
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

    await command.status()
}