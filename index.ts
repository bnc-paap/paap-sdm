import { GitProject } from "@atomist/automation-client";
import { CommandHandlerRegistration, hasFile } from "@atomist/sdm";
import {
    configure,
    container, ContainerRegistration,
} from "@atomist/sdm-core";
import * as os from "os";
import * as path from "path";

export const configuration = configure(async sdm => {
    sdm.addCommand(helloWorldCommand);
    return {
        node: {
            test: hasFile("package.json"),
            goals: [
                container(
                    `node`,
                    {
                        containers: [{
                            args: ["sh", "-c", "npm install && npm test"],
                            env: [{ name: "NODE_ENV", value: "development" }],
                            image: `node:10.16.0`,
                            name: "npm",
                        }],
                    },
                ),
            ],
        },
        maven: {
            test: hasFile("pom.xml"),
            goals: [
                container(
                    `mvn8`,
                    {
                        containers: [{
                            args: ["mvn", "package"],
                            image: `maven:3.6.1-jdk-8`,
                            name: "maven",
                        }],
                        output: [{
                            classifier: "target",
                            pattern: { directory: "target" },
                        }],
                    },
                ),
            ],
        },
        debugStep: {
            dependsOn: ["maven"],
            goals: [
                container(
                    `debugStep`,
                    {
                        containers: [{
                            args: ["ls", "-la"],
                            image: `ubuntu:18.04`,
                            name: "ubuntu",
                        }],
                        input: ["target"],
                    },
                ),
            ],
        },
        docker: {
            dependsOn: ["debugStep"],
            test: hasFile("Dockerfile"),
            goals: [
                container("docker", {
                    callback: async (r, p) => {
                        const safeOwner = p.id.owner.replace(/[^a-z0-9]+/g, "");
                        r.containers[0].args.push(`--destination=${safeOwner}/${p.id.repo}:${p.id.sha}`);
                        return r;
                    },
                    containers: [{
                        args: [
                            "--context=dir://atm/home",
                            "--dockerfile=Dockerfile",
                            "--no-push",
                            "--single-snapshot",
                        ],
                        image: "gcr.io/kaniko-project/executor:v0.10.0",
                        name: "kaniko",
                    }],
                    input: ["target"],
                }),
            ],
        },
    };
});

export const helloWorldCommand: CommandHandlerRegistration = {
    name: "HelloWorld",
    description: "Responds with a friendly greeting to everyone",
    intent: "hello",
    listener: async ci => {
        await ci.addressChannels("Hello, world");
        return {code: 0};
    },
};
