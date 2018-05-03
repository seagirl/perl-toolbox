"use strict";

import * as cp from "child_process";
import * as vscode from "vscode";

export default class PerlSyntaxProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private command: vscode.Disposable;
  private configuration: vscode.WorkSpace.Configuration;
  private document: vscode.TextDocument;

  public activate(subscriptions: vscode.Disposable[]) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
    vscode.workspace.onDidCloseTextDocument(
      textDocument => {
        this.diagnosticCollection.delete(textDocument.uri);
      },
      null,
      subscriptions
    );

    vscode.workspace.onDidOpenTextDocument(this.check, this, subscriptions);
    vscode.workspace.onDidSaveTextDocument(this.check, this);
  }

  public dispose(): void {
    this.diagnosticCollection.clear();
    this.diagnosticCollection.dispose();
    this.command.dispose();
  }

  private check(textDocument: vscode.TextDocument) {
    this.document = textDocument;
    this.configuration = vscode.workspace.getConfiguration(
      "perl-toolbox.syntax"
    );
    if (textDocument.languageId !== "perl") {
      return;
    }
    if (!this.configuration.enabled) {
      return;
    }
    let decoded = "";

    let proc = cp.spawn(
      this.configuration.exec,
      ["-c", this.document.fileName],
      this.getCommandOptions()
    );

    proc.stderr.on("data", (data: Buffer) => {
      decoded += data;
    });

    proc.stdout.on("end", () => {
      this.diagnosticCollection.set(
        this.document.uri,
        this.getDiagnostics(decoded)
      );
    });
  }

  private getCommandOptions() {
    return {
      shell: true,
      cwd: this.configuration.path
    };
  }

  private getDiagnostics(output) {
    let diagnostics: vscode.Diagnostic[] = [];
    output.split("\n").forEach(violation => {
      if (this.isValidViolation(violation)) {
        diagnostics.push(this.createDiagnostic(violation));
      }
    });
    return diagnostics;
  }

  private createDiagnostic(violation) {
    return new vscode.Diagnostic(
      this.getRange(violation),
      "Syntax: " + violation,
      vscode.DiagnosticSeverity.Error
    );
  }

  private getRange(violation) {
    let patt = /line\s+(\d+)/i;
    let line = patt.exec(violation)[1];
    return new vscode.Range(Number(line) - 1, 0, Number(line) - 1, 300);
  }

  private isValidViolation(violation) {
    let patt = /line\s+\d+/i;
    return patt.exec(violation);
  }
}