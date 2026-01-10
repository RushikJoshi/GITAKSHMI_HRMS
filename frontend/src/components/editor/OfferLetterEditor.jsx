import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import './document.css'; // Shared Styles for WYSIWYG

import {
    Bold, Italic, Underline as UnderlineIcon,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Palette, Link as LinkIcon,
    Table as TableIcon, Undo, Redo,
    Image as ImageIcon,
    Save, Indent, Outdent, FilePlus, ArrowUpWideNarrow,
    Layout, CheckSquare, Square, PaintBucket, Minus
} from 'lucide-react';

import '../LetterEditor.css';
import './document.css'; // SHARED CSS SOURCE OF TRUTH

import { ResizableImage } from '../../extensions/ResizableImage';
import { ParagraphIndent } from '../../extensions/ParagraphIndent';
import { FontSize } from '../../extensions/FontSize';
import { PlaceholderExtension } from '../../extensions/PlaceholderExtension.jsx';
import { PageBreakExtension } from '../../extensions/PageBreakExtension';
import { LineHeightExtension } from '../../extensions/LineHeightExtension';
import { ParagraphSpacing } from '../../extensions/ParagraphSpacing';

// --- Custom Table Extension ---
const CustomTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            class: {
                default: null,
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => {
                    if (!attributes.class) return {};
                    return { class: attributes.class }
                }
            },
            style: {
                default: null,
                parseHTML: element => element.getAttribute('style'),
                renderHTML: attributes => {
                    if (!attributes.style) return {};
                    return { style: attributes.style };
                },
            },
        }
    }
});

// --- Toolbar Component ---
const MenuBar = ({ editor, onInsertImage, showHeader, setShowHeader, showFooter, setShowFooter, isLetterPad }) => {
    const [showTableMenu, setShowTableMenu] = useState(false);
    const [showSpacingMenu, setShowSpacingMenu] = useState(false);
    const [_showLayoutMenu, _setShowLayoutMenu] = useState(false);

    if (!editor) return <div className="p-2 bg-gray-50 border-b text-gray-400 text-sm">Loading tools...</div>;

    const insertTable = (rows, cols) => {
        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
        setShowTableMenu(false);
    };

    return (
        <div className="flex flex-col border-b border-gray-200 bg-white sticky top-0 z-30 shadow-sm print:hidden">
            <div className="flex flex-wrap items-center gap-1 p-2">

                {/* History */}
                <div className="flex items-center space-x-1 border-r border-gray-300 pr-2 mr-1">
                    <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"><Undo size={18} /></button>
                    <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 text-gray-600"><Redo size={18} /></button>
                </div>

                {/* Fonts */}
                <div className="flex items-center space-x-1 border-r border-gray-300 pr-2 mr-1">
                    <select className="h-8 text-sm border border-gray-300 rounded px-1 w-32"
                        onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
                        value={editor.getAttributes('textStyle').fontFamily || ''}>
                        <option value="">Font Family</option>
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Verdana">Verdana</option>
                    </select>
                    <select className="h-8 text-sm border border-gray-300 rounded px-1 w-16"
                        onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
                        value={editor.getAttributes('textStyle').fontSize || ''}>
                        <option value="">Size</option>
                        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24].map(s => <option key={s} value={s}>{s}pt</option>)}
                    </select>
                </div>

                {/* Formatting */}
                <div className="flex items-center space-x-0.5 border-r border-gray-300 pr-2 mr-1">
                    <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded ${editor.isActive('bold') ? 'bg-blue-100' : ''}`}><Bold size={18} /></button>
                    <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded ${editor.isActive('italic') ? 'bg-blue-100' : ''}`}><Italic size={18} /></button>
                    <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded ${editor.isActive('underline') ? 'bg-blue-100' : ''}`}><UnderlineIcon size={18} /></button>
                </div>

                {/* Lists & Align */}
                <div className="flex items-center space-x-0.5 border-r border-gray-300 pr-2 mr-1">
                    <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded ${editor.isActive('bulletList') ? 'bg-blue-100' : ''}`}><List size={18} /></button>
                    <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded ${editor.isActive('orderedList') ? 'bg-blue-100' : ''}`}><ListOrdered size={18} /></button>

                    {/* Indent / Outdent (Crucial for Nested Lists 1 -> a -> i) */}
                    <button onClick={() => {
                        if (editor.isActive('listItem')) editor.chain().focus().liftListItem('listItem').run();
                        else editor.chain().focus().outdent().run();
                    }} className="p-1.5 rounded hover:bg-gray-100" title="Outdent (Shift+Tab)">
                        <Outdent size={18} />
                    </button>
                    <button onClick={() => {
                        if (editor.isActive('listItem')) editor.chain().focus().sinkListItem('listItem').run();
                        else editor.chain().focus().indent().run();
                    }} className="p-1.5 rounded hover:bg-gray-100" title="Indent (Tab)">
                        <Indent size={18} />
                    </button>

                    <div className="w-px h-6 bg-gray-300 mx-1"></div>

                    <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1.5 rounded ${editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100' : ''}`}><AlignLeft size={18} /></button>
                    <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1.5 rounded ${editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100' : ''}`}><AlignCenter size={18} /></button>
                    <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={`p-1.5 rounded ${editor.isActive({ textAlign: 'justify' }) ? 'bg-blue-100' : ''}`}><AlignJustify size={18} /></button>
                </div>

                {/* Layout & Spacing */}
                <div className="flex items-center space-x-1">
                    {/* Spacing Dropdown */}
                    <div className="relative">
                        <button onClick={() => setShowSpacingMenu(!showSpacingMenu)} className={`p-1.5 rounded ${showSpacingMenu ? 'bg-blue-100' : ''}`} title="Spacing"><ArrowUpWideNarrow size={18} /></button>
                        {showSpacingMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-white border shadow-xl rounded z-50 w-48 p-2 flex flex-col gap-2">
                                <div>
                                    <div className="text-xs font-semibold text-slate-500 mb-1">Line Height</div>
                                    <div className="flex gap-1 justify-between">
                                        {[1.0, 1.15, 1.5, 2.0].map(h => (
                                            <button key={h} onClick={() => { editor.chain().focus().setLineHeight(String(h)).run(); setShowSpacingMenu(false); }} className="px-2 py-1 hover:bg-blue-50 border text-xs">{h}</button>
                                        ))}
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100"></div>
                                <div>
                                    <div className="text-xs font-semibold text-slate-500 mb-1">List Style</div>
                                    <div className="flex flex-col gap-1">
                                        <button onClick={() => { editor.chain().focus().toggleOrderedList().run(); setShowSpacingMenu(false); }} className="text-left px-2 py-1 hover:bg-gray-50 text-xs">1. Numbered</button>
                                        <button onClick={() => { editor.chain().focus().toggleOrderedList().sinkListItem('listItem').run(); setShowSpacingMenu(false); }} className="text-left px-2 py-1 hover:bg-gray-50 text-xs">a. Alphabet (Indent)</button>
                                    </div>
                                </div>
                                <div className="h-px bg-slate-100"></div>
                                <div>
                                    <div className="text-xs font-semibold text-slate-500 mb-1">Paragraph Spacing</div>
                                    <div className="flex gap-1 justify-between">
                                        <button onClick={() => {
                                            // ZERO SPACING LOGIC
                                            editor.chain().focus().setMarginBottom('0pt').setLineHeight('1.0').run();
                                            setShowSpacingMenu(false);
                                        }} className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded" title="Remove all spacing">
                                            0px
                                        </button>
                                        {['6pt', '12pt'].map(pt => (
                                            <button key={pt} onClick={() => { editor.chain().focus().setMarginBottom(pt).run(); setShowSpacingMenu(false); }} className="px-2 py-1 hover:bg-blue-50 border text-xs">{pt}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {showSpacingMenu && <div className="fixed inset-0 z-40" onClick={() => setShowSpacingMenu(false)}></div>}
                    </div>

                    <button onClick={onInsertImage} className="p-1.5 rounded hover:bg-gray-100"><ImageIcon size={18} /></button>
                    <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className="p-1.5 rounded hover:bg-gray-100" title="Insert Horizontal Line"><Minus size={18} /></button>

                    <div className="relative">
                        <button onClick={() => setShowTableMenu(!showTableMenu)} className={`p-1.5 rounded ${showTableMenu ? 'bg-blue-100' : ''}`}><TableIcon size={18} /></button>
                        {showTableMenu && (
                            <div className="absolute top-full left-0 mt-1 bg-white border shadow-xl rounded z-50 p-2 grid grid-cols-3 gap-1 w-32">
                                {[{ r: 2, c: 2 }, { r: 3, c: 3 }, { r: 4, c: 4 }].map(s => (
                                    <button key={s.r + s.c} onClick={() => insertTable(s.r, s.c)} className="p-1 hover:bg-blue-50 border text-xs">{s.r}x{s.c}</button>
                                ))}
                            </div>
                        )}
                        {showTableMenu && <div className="fixed inset-0 z-40" onClick={() => setShowTableMenu(false)}></div>}
                    </div>
                </div>

                {!isLetterPad && (
                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => setShowHeader(!showHeader)} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">
                            {showHeader ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />} Header
                        </button>
                        <button onClick={() => setShowFooter(!showFooter)} className="text-xs flex items-center gap-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">
                            {showFooter ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />} Footer
                        </button>
                    </div>
                )}
            </div>

            {/* Placeholders */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-xs overflow-x-auto">
                <span className="font-bold text-gray-700 whitespace-nowrap">Insert:</span>
                {[
                    { l: 'Candidate Name', id: 'candidate_name' },
                    { l: 'Designation', id: 'designation' },
                    { l: 'Joining Date', id: 'joining_date' },
                    { l: 'CTC', id: 'ctc' },
                    { l: 'Location', id: 'location' },
                    { l: 'Address', id: 'address' },
                ].map(p => (
                    <button key={p.id} onClick={() => editor.chain().focus().insertPlaceholder({ id: p.id, label: p.l }).run()} className="px-2 py-0.5 bg-white border rounded hover:bg-blue-50 font-mono text-[10px] text-blue-700">
                        {`{${p.l}}`}
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- Hook ---
const useConfiguredEditor = (content, onUpdate, onFocus) => {
    return useEditor({
        extensions: [
            StarterKit.configure({ bulletList: { keepMarks: true, keepAttributes: false }, orderedList: { keepMarks: true, keepAttributes: false } }),
            Underline, TextStyle, FontFamily, Color, Highlight.configure({ multicolor: true }),
            Link.configure({ openOnClick: false }),
            TextAlign.configure({ types: ['heading', 'paragraph', 'image'] }),
            CustomTable.configure({ resizable: true }), TableRow, TableHeader, TableCell,
            FontSize, ResizableImage, ParagraphIndent, PlaceholderExtension, PageBreakExtension, LineHeightExtension, ParagraphSpacing
        ],
        content: content,
        onUpdate: ({ editor }) => onUpdate && onUpdate(editor.getHTML()),
        onFocus: ({ editor }) => onFocus && onFocus(editor),
        editorProps: { attributes: { class: 'focus:outline-none h-full max-w-none' } }
    });
};

/* --- MAIN COMPONENT --- */
const OfferLetterEditor = ({
    initialContent = '', initialHeader = '', initialFooter = '',
    initialHeaderHeight = 40, initialFooterHeight = 30,
    initialHasHeader = true, initialHasFooter = true,
    templateType = 'BLANK', backgroundUrl = '',
    onSave
}) => {
    const fileInputRef = useRef(null);
    const [activeEditor, setActiveEditor] = useState(null);
    const [headerHeight, setHeaderHeight] = useState(initialHeaderHeight);
    const [footerHeight, setFooterHeight] = useState(initialFooterHeight);
    const [showHeader, setShowHeader] = useState(initialHasHeader);
    const [showFooter, setShowFooter] = useState(initialHasFooter);
    const [isResizing, setIsResizing] = useState(null);

    const isLetterPad = templateType === 'LETTER_PAD';

    const headerEditor = useConfiguredEditor(initialHeader || `<p style="text-align: center"><strong>Company Name</strong></p>`, null, (e) => setActiveEditor(e));
    const bodyEditor = useConfiguredEditor(initialContent, null, (e) => setActiveEditor(e));
    const footerEditor = useConfiguredEditor(initialFooter || `<p style="text-align: center; font-size: 10px;">Company Address</p>`, null, (e) => setActiveEditor(e));

    // Force Header/Footer visibility logic for Letter Pad
    useEffect(() => {
        if (isLetterPad) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowHeader(true);
            setShowFooter(true);
        } else {
            setShowHeader(initialHasHeader);
            setShowFooter(initialHasFooter);
        }
    }, [isLetterPad, initialHasHeader, initialHasFooter]);

    // Default active editor to bodyEditor when loaded
    useEffect(() => {
        if (bodyEditor && !activeEditor) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveEditor(bodyEditor);
        }
    }, [bodyEditor, activeEditor]);

    // Resizing
    const handleMouseMove = useCallback((e) => {
        if (!isResizing) return;
        const dy = e.movementY * 0.264583; // px to mm
        if (isResizing === 'header') setHeaderHeight(p => Math.max(5, Math.min(150, p + dy)));
        else if (isResizing === 'footer') setFooterHeight(p => Math.max(5, Math.min(100, p - dy)));
    }, [isResizing]);

    const handleMouseUp = useCallback(() => setIsResizing(null), []);
    useEffect(() => {
        if (isResizing) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
        else { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); }
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    const handleSave = () => {
        if (onSave && headerEditor && bodyEditor && footerEditor) {
            onSave({
                header: headerEditor.getHTML(),
                body: bodyEditor.getHTML(),
                footer: footerEditor.getHTML(),
                headerHeight, footerHeight,
                hasHeader: showHeader, hasFooter: showFooter
            });
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (file && activeEditor) {
            const reader = new FileReader();
            reader.onload = (event) => activeEditor.chain().focus().setImage({ src: event.target.result }).run();
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 items-center overflow-auto py-8">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

            {/* STYLES FOR WYSIWYG */}
            <style>{`
                .ProseMirror { height: 100%; }
                .a4-page {
                    /* Add dynamic background logic if needed, but base styles come from document.css */
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    ${isLetterPad && backgroundUrl ? `
                        background-image: url('${backgroundUrl.startsWith('http') ? backgroundUrl : (import.meta.env.VITE_API_URL || 'https://hrms.gitakshmi.com') + (backgroundUrl.startsWith('/') ? '' : '/') + backgroundUrl}');
                        background-size: 100% 100%;
                        background-repeat: no-repeat;
                    ` : ''}
                }
                .editable-zone { padding: 5mm 5mm; outline: none; }
                .header-zone { 
                    border-bottom: ${isLetterPad ? 'none' : '1px dashed #e5e7eb'}; 
                    background-color: ${isLetterPad ? 'transparent' : 'rgba(249, 250, 251, 0.3)'}; 
                    position: relative; z-index: 50; 
                }
                .footer-zone { 
                    border-top: ${isLetterPad ? 'none' : '1px dashed #e5e7eb'}; 
                    background-color: ${isLetterPad ? 'transparent' : 'rgba(249, 250, 251, 0.3)'}; 
                    position: relative; margin-top: auto; z-index: 50; 
                }
                .body-zone { flex: 1; position: relative; z-index: 10; background: transparent; }
                .zone-resizer-handle {
                    position: absolute; left: 0; right: 0; height: 12px; z-index: 100; cursor: row-resize; 
                    opacity: 0; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;
                }
                .zone-resizer-handle:hover, .header-zone:hover .zone-resizer-handle, .footer-zone:hover .zone-resizer-handle { opacity: 1; }
                .zone-resizer-handle::before { content: ""; width: 40px; height: 4px; background: #3b82f6; border-radius: 2px; }
                .body-zone ol { list-style-type: decimal; }
                .body-zone ol ol { list-style-type: lower-alpha; }
                .body-zone ol ol ol { list-style-type: lower-roman; }
                .body-zone ul { list-style-type: disc; }
                .body-zone ul ul { list-style-type: circle; }
                .body-zone li { margin-bottom: 4px; }
            `}</style>

            <div className="w-[210mm] flex flex-col items-stretch space-y-4">
                <div className="rounded-sm bg-white shadow-xl relative">
                    <MenuBar editor={activeEditor} onInsertImage={() => fileInputRef.current?.click()} showHeader={showHeader} setShowHeader={setShowHeader} showFooter={showFooter} setShowFooter={setShowFooter} isLetterPad={isLetterPad} />

                    {activeEditor && (
                        <BubbleMenu editor={activeEditor} tippyOptions={{ duration: 100 }} shouldShow={({ editor }) => editor.isActive('table')}>
                            <div className="bg-white shadow-xl border p-1 rounded-lg flex gap-1 text-xs">
                                <button onClick={() => activeEditor.chain().focus().addColumnBefore().run()} className="p-1 hover:bg-gray-100">+Col</button>
                                <button onClick={() => activeEditor.chain().focus().deleteColumn().run()} className="p-1 text-red-600">Del Col</button>
                                <button onClick={() => activeEditor.chain().focus().addRowAfter().run()} className="p-1 hover:bg-gray-100">+Row</button>
                                <button onClick={() => activeEditor.chain().focus().deleteRow().run()} className="p-1 text-red-600">Del Row</button>
                                <button onClick={() => activeEditor.chain().focus().deleteTable().run()} className="p-1 text-red-600 font-bold">Trash</button>
                            </div>
                        </BubbleMenu>
                    )}

                    <div className="bg-gray-200 p-8 flex justify-center print:bg-white print:p-0">
                        <div className="a4-page">
                            {/* Header */}
                            {(showHeader || isLetterPad) && (
                                <div className="header-zone group" style={{ height: `${headerHeight}mm`, flexShrink: 0 }}>
                                    {!isLetterPad && <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-blue-50 z-50">
                                        <span className="text-[10px] text-blue-600 font-bold">Header</span>
                                    </div>}
                                    {/* Resizer */}
                                    <div className="absolute bottom-0 left-0 w-full h-1 cursor-ns-resize z-50 hover:bg-blue-400 group-hover:bg-blue-200 transition-colors zone-resizer-handle flex justify-center items-center"
                                        onMouseDown={() => setIsResizing('header')} />

                                    {!isLetterPad ? (
                                        <EditorContent editor={headerEditor} className="editable-zone h-full overflow-hidden" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center"></div>
                                    )}
                                </div>
                            )}

                            {/* Body */}
                            <div className="editable-zone body-zone" style={{ padding: '0 5mm' }} onClick={() => bodyEditor?.commands.focus()}>
                                <EditorContent editor={bodyEditor} />
                            </div>

                            {/* Footer */}
                            {(showFooter || isLetterPad) && (
                                <div className="footer-zone group mt-auto" style={{ height: `${footerHeight}mm`, flexShrink: 0 }}>
                                    {!isLetterPad && <div className="absolute bottom-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer bg-blue-50 z-50">
                                        <span className="text-[10px] text-blue-600 font-bold">Footer</span>
                                    </div>}
                                    {/* Resizer */}
                                    <div className="absolute top-0 left-0 w-full h-1 cursor-ns-resize z-50 hover:bg-blue-400 group-hover:bg-blue-200 transition-colors zone-resizer-handle flex justify-center items-center"
                                        onMouseDown={() => setIsResizing('footer')} />

                                    {!isLetterPad ? (
                                        <EditorContent editor={footerEditor} className="editable-zone h-full overflow-hidden" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center"></div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-4 print:hidden w-[210mm] mt-4">
                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm flex items-center gap-2">
                    <Save size={16} /> Save Template
                </button>
            </div>
        </div>
    );
};

export default OfferLetterEditor;
