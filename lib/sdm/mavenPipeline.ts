import { GitHubRepoRef, GitProject } from "@atomist/automation-client";
import { CommandHandlerRegistration, GeneratorRegistration, hasFile } from "@atomist/sdm";
import {
    CompressingGoalCache,
    configure,
    container, ContainerRegistration,
} from "@atomist/sdm-core";
import {
    SpringProjectCreationParameterDefinitions,
    SpringProjectCreationParameters,
    TransformMavenSpringBootSeedToCustomProject
} from "@atomist/sdm-pack-spring";
import * as os from "os";
import * as path from "path";

const MavenGenerator: GeneratorRegistration<SpringProjectCreationParameters> = {
    name: "MavenGenerator",
    intent: "create maven project",
    description: "Creates a new Maven project",
    tags: ["maven", "java"],
    autoSubmit: true,
    parameters: SpringProjectCreationParameterDefinitions,
    startingPoint: GitHubRepoRef.from({ owner: "atomist-seeds", repo: "spring-rest", branch: "master" }),
    transform: [
        ...TransformMavenSpringBootSeedToCustomProject,
    ],
};

export const mavenPipeline = configure(async sdm => {
    sdm.addCommand(helloWorldCommand);
    sdm.addGeneratorCommand(MavenGenerator);
    sdm.configuration.sdm.cache = {
        enabled: true,
        path: path.join(os.homedir(), ".atomist", "cache", "container"),
        store: new CompressingGoalCache(),
    };
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
        docker: {
            dependsOn: ["maven"],
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
