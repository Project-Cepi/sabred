import { colors } from "https://deno.land/x/cliffy@v0.20.1/ansi/colors.ts";

const rocketEmoji = "🚀"

const grabSabreCommand = async (): Promise<Deno.Process> => {
    console.log("")
    console.log(rocketEmoji, colors.blue(`Starting sabre...`))

    const killCommand = Deno.run({ 
        cmd: ["fuser", "-k", "25565/tcp"],
        stderr: "piped"
    })

    await killCommand.status()

    return Deno.run({
        cmd: ["java", "-Xmx2024M", "-Xms2024M", "-jar", "sabre.jar"],
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