export class ActionModel {
  constructor(
    readonly action: string,
    readonly content: string,
    readonly filePath: string,
    readonly lastCommitId: string,
  ) {}
}
