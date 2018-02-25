import * as React from "react";
import IDiscussionBoardProps from "./IDiscussionBoardProps";
import IDiscussionBoardState from "./IDiscussionBoardState";
import SocialModule from "../../../modules/SocialModule";
import IDiscussion from "../../../models/IDiscussion";
import { Web, PermissionKind } from "sp-pnp-js";
import DiscussionReply from "../DiscussionReply/DiscussionReply";
import { IDiscussionReply, DiscussionPermissionLevel } from "../../../models/IDiscussionReply";
import * as immutability from "immutability-helper";

// Needed to get it work at runtime
const update = immutability as any;

class DiscussionBoard extends React.Component<IDiscussionBoardProps, IDiscussionBoardState> {

    private _socialModule: SocialModule;
    private _associatedPageId: number;
    private _parentId: number;
    private _dicussionBoardListRelativeUrl: string;

    public constructor() {

        super();

        this.state = {
            discussion: null,
            userPermissions: [],
            inputValue: ""
        };

        this._dicussionBoardListRelativeUrl = `${_spPageContextInfo.webServerRelativeUrl}/Lists/Comments`;
        this._socialModule = new SocialModule(this._dicussionBoardListRelativeUrl);

        // Handlers
        this.addNewComment = this.addNewComment.bind(this);
        this.deleteReply = this.deleteReply.bind(this);
        this.updateReply = this.updateReply.bind(this);

        this.onValueChange = this.onValueChange.bind(this);
    }

    public render() {

        let renderPageComments = null;

        if (this.state.discussion) {
            renderPageComments = this.state.discussion.Replies.map((reply, index) => {
                return <DiscussionReply key={ index } addNewReply= { this.addNewComment } deleteReply={ this.deleteReply } updateReply={ this.updateReply } reply={ reply }/>    
            });
        }
            
        let renderNewReply = null;

        // If the current user can add list item to the list, it means he can comment
        if (this.state.userPermissions.indexOf(DiscussionPermissionLevel.Add) !== -1) {
            renderNewReply = <div>
                <textarea value={ this.state.inputValue } onChange={ this.onValueChange } placeholder="Add your comment..."></textarea>
                <button type="button" onClick={ () => { 
       
                    let parentId = null;
                    if (this.state.discussion) {
                        parentId = this.state.discussion.Id;
                    }

                    this.addNewComment(parentId, this.state.inputValue);
                    
                }}>Add new comment</button>
            </div>
        }

        return <div>
            { renderPageComments }
            { renderNewReply }
        </div>
    }

    public onValueChange(e: any) {
        this.setState({ inputValue: e.target.value });
    }

    public async componentDidMount() {

        this._associatedPageId = _spPageContextInfo.pageItemId;

        // Load JSOM dependencies
        await this._socialModule.init();

        // Retrieve the discussion for this page
        await this.getPageDiscussion(this._associatedPageId);
        
        // Get current user permissions
        const userListPermissions = await this._socialModule.getCurrentUserPermissionsOnList(this._dicussionBoardListRelativeUrl);

        this.setState({
            userPermissions: userListPermissions,
        });
    }

    public async addNewComment(parentId: number, replyBody: string) {

        if (!this.state.inputValue) {
            alert("You can't post an empty comment");
        } else {
            let currentDiscussion = this.state.discussion;

            // First comment will create a new discussion
            if (!parentId) {
                const newDiscussion = await this.createNewDiscussion($("#title").text(), window.location.href);
                currentDiscussion = update(currentDiscussion, { $set: newDiscussion});

                // Set the new parent Id
                parentId = newDiscussion.Id;
            }

            // Create reply to the discussion and and it to the state
            // Set the content as HTML (default field type)
            const reply = await this.createNewDiscussionReply(parentId, `<div>${replyBody}</div>`);
            currentDiscussion = update(currentDiscussion, { Replies: { $push: [reply]} });

            // Update the discussion
            this.setState({
                discussion: currentDiscussion,
                inputValue: ""
            });
        }
    }

    public async deleteReply(replyId: number) {

        if (confirm('Are you sure you want to delete this comment?')) {
            await this._socialModule.deleteReply(replyId);

            const updatedReplies = this.state.discussion.Replies.filter((reply) => {
                return reply.Id !== replyId;
            });

            // Update state
            this.setState({
                discussion: update(this.state.discussion, { Replies: { $set: updatedReplies }}),
            });
        } 
    }

    public async updateReply(replyToUpdate: IDiscussionReply) {

        await this._socialModule.updateReply(replyToUpdate.Id, replyToUpdate.Body);

        const updatedReplies = this.state.discussion.Replies.map((currentReply) => {

            let updatedReply = currentReply;
            if (currentReply.Id === replyToUpdate.Id) {
                updatedReply.Body = replyToUpdate.Body;
            }
            return updatedReply;
        });

        // Update state
        this.setState({
            discussion: update(this.state.discussion, { Replies: { $set: updatedReplies }}),
        });
    }

    private async createNewDiscussion(title: string, body: string): Promise<IDiscussion>{
        return await this._socialModule.createNewDiscussion(this._associatedPageId, title, body);
    }

    private async getPageDiscussion(associatedPageId: number) {
        // Check if there is arleady a discussion for this page
        const discussion = await this._socialModule.getDiscussionById(associatedPageId);

        this.setState({
            discussion: discussion,
        });
    }

    private async createNewDiscussionReply(parentId: number, replyBody: string): Promise<IDiscussionReply> {
        return await this._socialModule.createNewDiscussionReply(parentId, replyBody);
    }

}

export default DiscussionBoard;