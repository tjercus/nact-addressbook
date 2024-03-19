#!/usr/bin/env node

const { v4: uuidv4 } = require("uuid");
const { start, dispatch, spawn, query } = require("nact");

const system = start();

const ContactProtocolTypes = {
  GET_CONTACTS: "GET_CONTACTS",
  GET_CONTACT: "GET_CONTACT",
  UPDATE_CONTACT: "UPDATE_CONTACT",
  REMOVE_CONTACT: "REMOVE_CONTACT",
  CREATE_CONTACT: "CREATE_CONTACT",
  // Operation sucessful
  SUCCESS: "SUCCESS",
  // And finally if the contact is not found
  NOT_FOUND: "NOT_FOUND",
};

const INITIAL_STATE = {
  contacts: [
    { id: "abc-123", name: "Henk", street: "Piet Smitstraat" },
    { id: "def-456", name: "Wim", street: "Groningerstraatweg" },
  ],
};

const contactsService = spawn(
  system,
  (state = INITIAL_STATE, msg, ctx) => {
    if (msg.type === ContactProtocolTypes.GET_CONTACTS) {
      // Return all the contacts as an array
      dispatch(msg.sender, {
        payload: Object.values(state.contacts),
        sender: ctx.self,
        type: ContactProtocolTypes.SUCCESS,
      });
    } else if (msg.type === ContactProtocolTypes.CREATE_CONTACT) {
      const newContact = { id: uuidv4(), ...msg.payload };
      const nextState = {
        contacts: { ...state.contacts, [newContact.id]: newContact },
      };
      dispatch(msg.sender, {
        type: ContactProtocolTypes.SUCCESS,
        // sender: ctx.self,
        payload: newContact,
      });
      return nextState;
    } else {
      // All these message types require an existing contact
      // So check if the contact exists
      const contact = state.contacts[msg.contactId];
      if (contact) {
        switch (msg.type) {
          case ContactProtocolTypes.GET_CONTACT: {
            dispatch(msg.sender, {
              payload: contact,
              type: ContactProtocolTypes.SUCCESS,
            });
            break;
          }
          case ContactProtocolTypes.REMOVE_CONTACT: {
            // Create a new state with the contact value to undefined
            const nextState = { ...state.contacts, [contact.id]: undefined };
            dispatch(msg.sender, {
              type: ContactProtocolTypes.SUCCESS,
              payload: contact,
            });
            return nextState;
          }
          case ContactProtocolTypes.UPDATE_CONTACT: {
            // Create a new state with the previous fields of the contact
            // merged with the updated ones
            const updatedContact = { ...contact, ...msg.payload };
            const nextState = {
              ...state.contacts,
              [contact.id]: updatedContact,
            };
            dispatch(msg.sender, {
              type: ContactProtocolTypes.SUCCESS,
              payload: updatedContact,
            });
            return nextState;
          }
        }
      } else {
        // If it does not, dispatch a not found message to the sender
        dispatch(msg.sender, {
          contactId: msg.contactId,
          sender: ctx.self,
          type: ContactProtocolTypes.NOT_FOUND,
        });
      }
    }
    // Return the current state if unchanged.
    return state;
  },
  "contacts"
);

/* ---------------- runtime: use the actor system ----------------- */

const createContact = async () => {
  const msg = {
    payload: { name: "John", street: "P. Circus" },
    sender: contactsService, // since the msg is sent from outside the system we use CS as a sender
    type: ContactProtocolTypes.CREATE_CONTACT,
  };
  // note that the standalone 'dispatch' comes from function.js and has three
  //   params while the internal dispatch on an actor has two and so do the TS typings!
  dispatch(contactsService, msg);
};

createContact().then(console.log);

const msg = {
  sender: contactsService,
  type: ContactProtocolTypes.GET_CONTACTS,
};

const getAllContacts = async () => {
  const result = await query(
    contactsService,
    (sender) => Object.assign(msg, { sender }),
    250
  ); // Set a 250ms timeout
  //
  return result;
};

getAllContacts().then((result) => {
  switch (result.type) {
    case ContactProtocolTypes.SUCCESS:
      console.log("getAllContacts", result.payload);
      break;
    case ContactProtocolTypes.NOT_FOUND:
      console.log(getAllContacts, "contact not found");
      break;
    default:
      // This shouldn't ever happen, but means that something is really wrong in the application
      console.error("getAllContacts, ERROR:", JSON.stringify(result));
      break;
  }
});
