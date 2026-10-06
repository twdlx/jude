require('dotenv').config({ quiet: true });
const { ButtonStyle, ChannelType, Client, ContainerBuilder, GatewayIntentBits, LabelBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, StringSelectMenuBuilder, TextDisplayBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { buildOrderPanel, buildTicketMessage } = require('./orderPanel');

if (!process.env.TOKEN) throw new Error('Set TOKEN in .env before starting the bot.');

const allowedUsers = new Set(['830030944416432159', '737181735846019112']);
const ORDER_CATEGORY_ID = '1215044053809242213';
const ADMIN_ROLE_ID = '1215420218705453096';
const orderTypes = { logo: 'Logo', banners: 'Banners', bundle: 'Bundle (Both)' };
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

function statusPanel(text) {
    return [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))];
}

function channelUsername(user) {
    return (user.username || user.id)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || user.id;
}

client.on('messageCreate', async (message) => {
    if (message.channel.isThread() && !message.author.bot && message.attachments.size > 0) {
        try {
            const parent = await message.guild?.channels.fetch(message.channel.parentId);
            const ownerId = parent?.topic?.match(/^order-owner:(\d+)$/)?.[1];
            const hasImage = message.attachments.some((file) =>
                file.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name || '')
            );
            if (parent?.parentId === ORDER_CATEGORY_ID && ownerId === message.author.id && hasImage) {
                if (parent.permissionOverwrites.cache.get(ownerId)?.allow.has(PermissionFlagsBits.SendMessages)) return;
                await parent.permissionOverwrites.edit(ownerId, { SendMessages: true });
                await message.channel.send({
                    content: `<@${ownerId}> **Reference received!** Your order channel is now unlocked. You can send your order details there.`,
                    allowedMentions: { users: [ownerId] },
                });
            }
        } catch (error) {
            console.error('Could not unlock order channel after reference upload:', error);
        }
    }
    if (message.author.bot || message.content.trim().toLowerCase() !== '-orderpanel') return;
    if (!allowedUsers.has(message.author.id) || !message.guild) return;
    try {
        await message.channel.send(buildOrderPanel());
        await message.delete().catch((error) => console.error('Could not delete command; check Manage Messages permission:', error));
    } catch (error) {
        console.error('Could not send order panel:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'order_claim') {
        const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
        if (!member?.roles.cache.has(ADMIN_ROLE_ID)) {
            await interaction.reply({ content: 'Only the admin team can claim order tickets.', flags: MessageFlags.Ephemeral });
            return;
        }
        const components = interaction.message.components.map((component) => component.toJSON());
        const button = components.flatMap((container) => container.components || [])
            .flatMap((component) => component.components || [])
            .find((component) => component.custom_id === 'order_claim');
        if (!button || button.disabled) {
            await interaction.reply({ content: 'This ticket has already been claimed.', flags: MessageFlags.Ephemeral });
            return;
        }
        button.label = `Claimed by ${interaction.user.username}`.slice(0, 80);
        button.style = ButtonStyle.Danger;
        button.disabled = true;
        try {
            if (interaction.channel?.name && !interaction.channel.name.startsWith('🔴')) {
                await interaction.channel.setName(`🔴・${interaction.channel.name.replace(/^[^a-z0-9]+/i, '')}`);
            }
            await interaction.update({ components });
        } catch (error) {
            console.error('Could not claim order ticket:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Could not claim this ticket. Please try again.', flags: MessageFlags.Ephemeral }).catch(console.error);
            }
        }
        return;
    }
    if (interaction.isButton() && interaction.customId === 'order_edit_details') {
        await interaction.reply({
            content: 'This ticket action is being set up. The admin team can help you here in the meantime.',
            flags: MessageFlags.Ephemeral,
        });
        return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'orderpanel_service') {
        const selectedType = interaction.values[0];
        if (!interaction.guild || !orderTypes[selectedType]) return;
        const product = new StringSelectMenuBuilder()
            .setCustomId('order_product')
            .setPlaceholder('Select the product you want to order')
            .addOptions(Object.entries(orderTypes).map(([value, label]) => ({ label, value, default: value === selectedType })));
        const modal = new ModalBuilder()
            .setCustomId(`order_form:${selectedType}`)
            .setTitle(`Open a ${orderTypes[selectedType]} Ticket`)
            .addLabelComponents(new LabelBuilder().setLabel('Product').setStringSelectMenuComponent(product))
            .addLabelComponents(new LabelBuilder().setLabel('Quantity').setDescription('How many of this product do you want to order? Enter a number.').setTextInputComponent(
                new TextInputBuilder().setCustomId('order_quantity').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6)
            ))
            .addLabelComponents(new LabelBuilder().setLabel('Budget').setDescription('Enter a valid number for your budget, without prefixes or suffixes.').setTextInputComponent(
                new TextInputBuilder().setCustomId('order_budget').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12)
            ));
        await interaction.showModal(modal);
        return;
    }

    if (!interaction.isModalSubmit() || !interaction.customId.startsWith('order_form:')) return;
    const type = interaction.fields.getStringSelectValues('order_product')[0];
    const quantity = interaction.fields.getTextInputValue('order_quantity').trim();
    const budget = interaction.fields.getTextInputValue('order_budget').trim();
    if (!interaction.guild || !orderTypes[type]) return;
    if (!/^[1-9]\d*$/.test(quantity) || !/^\d+(?:\.\d{1,2})?$/.test(budget) || Number(budget) <= 0) {
        await interaction.reply({
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: statusPanel('## Please check your order details\n**Quantity** must be a whole number greater than zero. **Budget** must be a number greater than zero, with no currency symbol or suffix. Select the order type again to reopen the form.'),
        });
        return;
    }

    await interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: statusPanel(`## <a:Loading:1556975105387667556> Creating your ticket\n**<:pc_people:1556974509045846130> Customer:** <@${interaction.user.id}>\n**<:survey:1556974694807113761> Product Type:** ${orderTypes[type]}\n**<:pc_checklist:1556974321434361937> Quantity:** ${quantity}\n**<:pc_robux:1556974216740470844> Budget:** ${budget}`),
    });

    try {
        const category = await interaction.guild.channels.fetch(ORDER_CATEGORY_ID);
        const adminRole = await interaction.guild.roles.fetch(ADMIN_ROLE_ID);
        if (!category || category.type !== ChannelType.GuildCategory || !adminRole) {
            throw new Error('Order category or admin role is missing from this server.');
        }

        const channel = await interaction.guild.channels.create({
            name: `🔴・${type}-${channelUsername(interaction.user)}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `order-owner:${interaction.user.id}`,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
            ],
            reason: `${orderTypes[type]} order opened by ${interaction.user.tag} (${interaction.user.id})`,
        });

        const orderMessage = await channel.send(buildTicketMessage({ type: orderTypes[type], quantity, budget, userId: interaction.user.id }));
        const thread = await orderMessage.startThread({ name: `Order References - ${interaction.user.username}`.slice(0, 100) });
        await thread.send({
            content: `<@${interaction.user.id}> Please send your **reference image(s)** here to unlock your order channel.`,
            allowedMentions: { users: [interaction.user.id] },
        });
        await interaction.editReply({
            components: statusPanel(`## <:pc_link:1556970059065335928> Ticket created\nYour **${orderTypes[type]}** order channel is ready: ${channel}`),
            allowedMentions: { parse: [] },
        });
    } catch (error) {
        console.error('Could not create order ticket:', error);
        await interaction.editReply({
            components: statusPanel('## Could not create your ticket\nSomething went wrong while setting up your private order channel. Please try again or contact an admin.'),
        }).catch(console.error);
    }
});

client.login(process.env.TOKEN);
