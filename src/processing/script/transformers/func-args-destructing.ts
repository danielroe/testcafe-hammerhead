// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { ArrowFunctionExpression, FunctionDeclaration, FunctionExpression, VariableDeclarator } from 'estree';
import { Transformer } from './index';
import {
    createBlockStatement,
    createIdentifier,
    createReturnStatement,
    createVariableDeclaration,
    createVariableDeclarator
} from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import replaceNode from './replace-node';
import TempVariables from './temp-variables';

// Transform:
// function x ({a, b}, [c, d]) {}
// -->
// function x (_hh$temp0, _hh$temp1) {
//     var {a, b} = _hh$temp0,
//         [c, d] = _hh$temp1;
// }

export default function create<T extends (FunctionDeclaration | FunctionExpression | ArrowFunctionExpression)> (type: T['type']): Transformer<T> {
    return {
        nodeReplacementRequireTransform: false,

        nodeTypes: type,

        condition: node => {
            for (let param of node.params) {
                if (param.type === Syntax.AssignmentPattern)
                    param = param.left;

                if (param.type === Syntax.ObjectPattern || param.type === Syntax.ArrayPattern)
                    return true;
            }

            return false;
        },

        run: (node) => {
            const declarations: VariableDeclarator[] = [];

            for (let param of node.params) {
                let tempVarParent = node;

                if (param.type === Syntax.AssignmentPattern) {
                    // @ts-ignore
                    tempVarParent = param;
                    param         = param.left;
                }

                if (param.type === Syntax.ObjectPattern || param.type === Syntax.ArrayPattern) {
                    const tempVar = createIdentifier(TempVariables.generateName());

                    replaceNode(param, tempVar, tempVarParent, 'params');

                    declarations.push(createVariableDeclarator(param, tempVar));
                }
            }

            const declaration = createVariableDeclaration('var', declarations);

            if (node.body.type !== Syntax.BlockStatement) {
                // @ts-ignore
                const returnStmt = createReturnStatement(node.body);

                replaceNode(node.body, createBlockStatement([declaration, returnStmt]), node, 'body');
            }
            else
                replaceNode(null, declaration, node.body, 'body');

            declaration.reTransform = true;

            return null;
        }
    }
}