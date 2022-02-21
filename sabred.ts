import { colors } from "https://deno.land/x/cliffy@v0.20.1/ansi/colors.ts";
import { basename } from "https://deno.land/std@0.126.0/path/mod.ts";

const rocketEmoji = "🚀"
const infoEmoji = "❕"
const errorEmoji = "❌"

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
    console.log(errorEmoji, colors.red(`Could not find any files with .jar`))
    Deno.exit(0)
}

console.log(infoEmoji, colors.blue(`Using jar ${basename(jar)}`))

const grabSabreCommand = async (): Promise<Deno.Process> => {
    console.log("")
    console.log(rocketEmoji, colors.blue(`Starting sabre...`))

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

const watch = async() => {
    const watcher = Deno.watchFs("./extensions");

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