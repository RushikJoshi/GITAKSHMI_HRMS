import React, { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { Save, Upload, Trash2, FileImage } from 'lucide-react';

/**
 * Letter Settings - SIMPLIFIED VERSION
 * 
 * ONLY ONE OPTION: Upload Letter Pad (A4 size: 210 × 297 mm)
 * 
 * Letter Pad image already contains:
 * - Logo
 * - Footer
 * - Company details
 * 
 * No separate management needed.
 */
export default function LetterSettings() {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [letterPadUrl, setLetterPadUrl] = useState('');

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchLetterPad();
    }, []);

    const fetchLetterPad = async () => {
        try {
            const res = await api.get('/letters/company-profile');
            if (res.data?.branding?.letterheadBg) {
                setLetterPadUrl(res.data.branding.letterheadBg);
            }
        } catch {
            console.log('Letter pad not set up yet');
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File is too large. Max 5MB allowed.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        try {
            const res = await api.post('/uploads/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                const loadUrl = res.data.url.startsWith('http')
                    ? res.data.url
                    : `${import.meta.env.VITE_API_URL || 'https://hrms.gitakshmi.com'}${res.data.url}`;

                setLetterPadUrl(loadUrl);

                // Auto-save
                await saveLetterPad(loadUrl);
            }
        } catch (error) {
            console.error('Upload failed', error);
            alert('Failed to upload letter pad image');
        } finally {
            setUploading(false);
        }
    };

    const saveLetterPad = async (url) => {
        setLoading(true);
        try {
            // Only save letter pad URL in branding.letterheadBg
            const profileData = {
                branding: {
                    letterheadBg: url || letterPadUrl
                }
            };

            await api.post('/letters/company-profile', profileData);
            alert('Letter pad saved successfully!');
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save letter pad');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!confirm('Remove letter pad? Templates using "Use Letter Pad" will show blank pages.')) {
            return;
        }

        setLoading(true);
        try {
            const profileData = {
                branding: {
                    letterheadBg: ''
                }
            };

            await api.post('/letters/company-profile', profileData);
            setLetterPadUrl('');
            alert('Letter pad removed successfully!');
        } catch (error) {
            console.error('Remove error:', error);
            alert('Failed to remove letter pad');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto pb-20">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Letter Pad Settings</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Upload your pre-designed letter pad image (A4 size: 210 × 297 mm).
                    This image will be used as the background for all letters when "Use Letter Pad" is selected.
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <FileImage className="text-blue-600" size={20} />
                    <h2 className="font-semibold text-slate-800">Letter Pad Image</h2>
                </div>

                <div className="p-8">
                    <div className="max-w-2xl mx-auto">
                        {/* Upload Area */}
                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition relative group">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleUpload}
                                className="hidden"
                                accept="image/png, image/jpeg, image/jpg"
                            />

                            {letterPadUrl ? (
                                <div className="relative w-full">
                                    <div className="bg-white p-4 rounded-lg shadow-md border border-slate-200">
                                        <img
                                            src={letterPadUrl}
                                            alt="Letter Pad Preview"
                                            className="w-full h-auto max-h-[400px] object-contain mx-auto"
                                        />
                                    </div>
                                    <div className="mt-4 flex items-center justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading || loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                        >
                                            <Upload size={16} />
                                            {uploading ? 'Uploading...' : 'Replace Image'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRemove}
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                                        >
                                            <Trash2 size={16} />
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        {uploading ? (
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                        ) : (
                                            <Upload size={24} />
                                        )}
                                    </div>
                                    <p className="text-lg font-medium text-slate-700 mb-2">
                                        {uploading ? 'Uploading Letter Pad...' : 'Upload Letter Pad Image'}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        A4 Size Recommended (210mm × 297mm)
                                    </p>
                                    <p className="text-xs text-slate-400 mt-2">
                                        PNG, JPG, or JPEG • Max 5MB
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Instructions */}
                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Instructions</h3>
                            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                                <li>Upload a pre-designed letter pad image (A4 size: 210mm × 297mm)</li>
                                <li>The image should already include logo, footer, and company details</li>
                                <li>When creating templates, select "Use Letter Pad" to apply this background</li>
                                <li>Select "Blank Page" for templates without letter pad</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
