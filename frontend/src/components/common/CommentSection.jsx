import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://hrms.gitakshmi.com';

export default function CommentSection({ entityType, entityId }) {
    const [comments, setComments] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { user } = useAuth();

    const fetchComments = async () => {
        try {
            const res = await api.get(`/comments/${entityType}/${entityId}`);
            setComments(res.data);
            setError(null);
        } catch (error) {
            console.error("Failed to fetch comments", error);
            setError("Failed to load discussion.");
        }
    };

    useEffect(() => {
        fetchComments();
    }, [entityType, entityId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        setLoading(true);
        try {
            const res = await api.post(`/comments/${entityType}/${entityId}`, { message: newMessage });
            setComments([...comments, res.data]);
            setNewMessage('');
        } catch (error) {
            console.error("Failed to post comment", error);
            alert("Failed to post comment. Check permissions.");
        } finally {
            setLoading(false);
        }
    };

    const getProfilePic = (pic) => {
        if (!pic) return null;
        if (pic.startsWith('http')) return pic;
        return `${BACKEND_URL}${pic.startsWith('/') ? '' : '/'}${pic}`;
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <h3 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Discussion
                </h3>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto no-scrollbar">
                {error ? (
                    <div className="text-center py-8">
                        <p className="text-red-500 text-sm mb-2 font-medium">{error}</p>
                        <button onClick={fetchComments} className="text-xs text-blue-600 hover:text-blue-700 underline">Try again</button>
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-center text-slate-500 text-sm py-8">No comments yet. Start the discussion.</p>
                ) : (
                    comments.map((comment) => (
                        <div key={comment._id} className={`flex gap-3 ${comment.commentedBy?._id === user?.id ? 'flex-row-reverse' : ''}`}>
                            <div className="flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs border border-slate-200 dark:border-slate-600 overflow-hidden shadow-sm">
                                    {comment.commentedBy?.profilePic ? (
                                        <img src={getProfilePic(comment.commentedBy.profilePic)} alt="" className="h-8 w-8 rounded-full object-cover" />
                                    ) : (
                                        comment.commentedBy?.firstName?.charAt(0) || 'U'
                                    )}
                                </div>
                            </div>
                            <div className={`flex flex-col max-w-[80%] ${comment.commentedBy?._id === user?.id ? 'items-end' : ''}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        {comment.commentedBy?.firstName} {comment.commentedBy?.lastName}
                                    </span>
                                    <span className="text-[10px] text-slate-400 capitalize bg-slate-100 dark:bg-slate-700 px-1.5 rounded-full">
                                        {comment.commentedByRole}
                                    </span>
                                </div>
                                <div className={`p-3 rounded-2xl text-sm ${comment.commentedBy?._id === user?.id
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'
                                    }`}>
                                    {comment.message}
                                </div>
                                <span className="text-[10px] text-slate-400 mt-1">
                                    {new Date(comment.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={loading || !newMessage.trim()}
                        className="h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center transition disabled:opacity-50"
                    >
                        {loading ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
