// ----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// ----------------------------------------------------------------------------

import { CodeAction, CodeActionContext, Command, Range, Selection, Uri } from "vscode";
import { CachedValue } from "./CachedValue";
import { __debugMarkPositionInString, __debugMarkRangeInString } from "./debugMarkStrings";
import { INamedDefinition } from "./INamedDefinition";
import * as Json from "./JSON";
import * as language from "./Language";
import { PositionContext } from "./PositionContext";
import { ReferenceList } from "./ReferenceList";
import { nonNullValue } from "./util/nonNull";

/**
 * Represents a deployment-related JSON file
 */
export abstract class DeploymentDocument {
    // Parse result for the template JSON document as a whole
    private _jsonParseResult: Json.ParseResult;

    // The JSON node for the top-level JSON object (if the JSON is not empty or malformed)
    private _topLevelValue: Json.ObjectValue | undefined;

    private _schema: CachedValue<Json.StringValue | undefined> = new CachedValue<Json.StringValue | undefined>();

    /**
     * Constructor
     *
     * @param _documentText The string text of the document.
     * @param _documentId A unique identifier for this document. Usually this will be a URI to the document.
     */
    constructor(private _documentText: string, private _documentId: Uri) {
        nonNullValue(_documentId, "_documentId");

        this._jsonParseResult = Json.parse(_documentText);
        this._topLevelValue = Json.asObjectValue(this._jsonParseResult.value);
    }

    // tslint:disable-next-line:function-name
    public _debugShowTextAt(position: number | language.Span): string {
        if (position instanceof language.Span) {
            return __debugMarkRangeInString(this.documentText, position.startIndex, position.length);
        } else {
            return __debugMarkPositionInString(this.documentText, position);
        }
    }

    /**
     * Get the document text as a string.
     */
    public get documentText(): string {
        return this._documentText;
    }

    /**
     * Retrieves a section of the document text
     */
    public getDocumentText(span: language.Span, offsetIndex?: number): string {
        return span.getText(this.documentText, offsetIndex);
    }

    /**
     * The unique identifier for this deployment template, which indicates its location
     */
    public get documentId(): Uri {
        return this._documentId;
    }

    // Parse result for the template JSON document as a whole
    public get jsonParseResult(): Json.ParseResult {
        return this._jsonParseResult;
    }

    // The JSON node for the top-level JSON object (if the JSON is not empty or malformed)
    public get topLevelValue(): Json.ObjectValue | undefined {
        return this._topLevelValue;
    }

    public get schemaUri(): string | undefined {
        const schema = this.schemaValue;
        return schema ? schema.unquotedValue : undefined;
    }

    public get schemaValue(): Json.StringValue | undefined {
        return this._schema.getOrCacheValue(() => {
            const value: Json.ObjectValue | undefined = Json.asObjectValue(this._jsonParseResult.value);
            if (value) {
                const schema: Json.StringValue | undefined = Json.asStringValue(value.getPropertyValue("$schema"));
                if (schema) {
                    return schema;
                }
            }

            return undefined;
        });
    }

    public getMaxLineLength(): number {
        let max = 0;
        for (let len of this.jsonParseResult.lineLengths) {
            if (len > max) {
                max = len;
            }
        }

        return max;
    }

    public getCommentCount(): number {
        return this.jsonParseResult.commentCount;
    }

    /**
     * Get the number of lines that are in the file.
     */
    public get lineCount(): number {
        return this._jsonParseResult.lineLengths.length;
    }

    /**
     * Get the maximum column index for the provided line. For the last line in the file,
     * the maximum column index is equal to the line length. For every other line in the file,
     * the maximum column index is less than the line length.
     */
    public getMaxColumnIndex(lineIndex: number): number {
        return this._jsonParseResult.getMaxColumnIndex(lineIndex);
    }

    /**
     * Get the maximum document character index for this deployment template.
     */
    public get maxCharacterIndex(): number {
        return this._jsonParseResult.maxCharacterIndex;
    }

    public abstract getContextFromDocumentLineAndColumnIndexes(documentLineIndex: number, documentColumnIndex: number, associatedTemplate: DeploymentDocument | undefined): PositionContext;

    public abstract getContextFromDocumentCharacterIndex(documentCharacterIndex: number, associatedTemplate: DeploymentDocument | undefined): PositionContext;

    public getDocumentCharacterIndex(documentLineIndex: number, documentColumnIndex: number): number {
        return this._jsonParseResult.getCharacterIndex(documentLineIndex, documentColumnIndex);
    }

    public getDocumentPosition(documentCharacterIndex: number): language.Position {
        return this._jsonParseResult.getPositionFromCharacterIndex(documentCharacterIndex);
    }

    public getJSONTokenAtDocumentCharacterIndex(documentCharacterIndex: number): Json.Token | undefined {
        return this._jsonParseResult.getTokenAtCharacterIndex(documentCharacterIndex);
    }

    public getJSONValueAtDocumentCharacterIndex(documentCharacterIndex: number, containsBehavior: language.Contains): Json.Value | undefined {
        return this._jsonParseResult.getValueAtCharacterIndex(documentCharacterIndex, containsBehavior);
    }

    /**
     * Find all references in this document to the given named definition (which may or may not be in this document)
     */
    public abstract findReferencesToDefinition(definition: INamedDefinition): ReferenceList;

    /**
     * Provide commands for the given document and range.
     *
     * @param associatedDocument The associated document, if any (for a template file, the associated document is a parameter file,
     * for a parameter file, the associated document is a template file)
     * @param range The selector or range for which the command was invoked. This will always be a selection if
     * there is a currently active editor.
     * @param context Context carrying additional information.
     * @param token A cancellation token.
     * @return An array of commands, quick fixes, or refactorings or a thenable of such. The lack of a result can be
     * signaled by returning `undefined`, `null`, or an empty array.
     */
    public abstract async getCodeActions(associatedDocument: DeploymentDocument | undefined, range: Range | Selection, context: CodeActionContext): Promise<(Command | CodeAction)[]>;

    public abstract getErrors(associatedDocument: DeploymentDocument | undefined): Promise<language.Issue[]>;

    public abstract getWarnings(): language.Issue[];
}
